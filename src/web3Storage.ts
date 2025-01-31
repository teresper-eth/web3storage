import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import fileType from "file-type";

interface UploadResponse {
  STATUS_CODE?: number;
  RESPONSE: string;
}

// Add new interfaces
interface PinStatus {
  cid: string;
  status: "queued" | "pinning" | "pinned" | "failed";
  created: string;
  delegates: string[];
}

interface FileMetadata {
  name: string;
  size: number;
  cid: string;
  created: string;
  type: string;
  pins: PinStatus[];
}

/**
 * Utility functions for file handling
 */
export const utils = {
  /**
   * Converts a file size in bytes to a human-readable format
   */
  formatFileSize(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
  },

  /**
   * Validates a CID string
   */
  isValidCID(cid: string): boolean {
    // Basic CID validation - can be enhanced based on specific requirements
    const cidRegex = /^[a-zA-Z0-9]{46,59}$/;
    return cidRegex.test(cid);
  },

  /**
   * Creates a retry wrapper for API calls
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, i))
          );
        }
      }
    }

    throw lastError;
  },
};

export class Web3Storage {
  private readonly BASE_URL = "https://api.web3.storage/{}";

  // uploads and stores a file
  async upload(filePath: string, token: string): Promise<UploadResponse> {
    try {
      const fileContent = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);

      // Detect mime type
      const mimeType = await fileType.fromBuffer(fileContent);
      const contentType = mimeType?.mime || "application/octet-stream";

      const headers = {
        "Content-Type": contentType,
        Authorization: `Bearer ${token}`,
        "X-NAME": fileName,
      };

      const formData = new FormData();
      formData.append(fileName, new Blob([fileContent]), fileName);

      const uploadEndpoint = this.BASE_URL.replace("{}", "upload");
      const response = await axios.post(uploadEndpoint, formData, { headers });

      if (response.status === 200) {
        return {
          STATUS_CODE: 200,
          RESPONSE: JSON.stringify(response.data),
        };
      }

      return {
        RESPONSE: JSON.stringify(response.data),
      };
    } catch (error) {
      return {
        RESPONSE:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // retrieve information about an upload
  async status(cid: string, token: string): Promise<UploadResponse> {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const statusEndpoint = this.BASE_URL.replace("{}", `status/${cid}`);
      const response = await axios.get(statusEndpoint, { headers });

      if (response.status === 200) {
        return {
          STATUS_CODE: 200,
          RESPONSE: JSON.stringify(response.data),
        };
      }

      return {
        RESPONSE: JSON.stringify(response.data),
      };
    } catch (error) {
      return {
        RESPONSE:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // list previous uploads
  async userUploads(token: string): Promise<string> {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const uploadsEndpoint = this.BASE_URL.replace("{}", "user/uploads");
      const response = await axios.get(uploadsEndpoint, { headers });

      return JSON.stringify(response.data);
    } catch (error) {
      return error instanceof Error ? error.message : "Unknown error occurred";
    }
  }

  // returns a single upload
  getUpload(cid: string): string {
    return `https://${cid}.ipfs.w3s.link`;
  }

  /**
   * Retrieves the contents of a file by its CID
   */
  async retrieveFile(cid: string): Promise<Buffer> {
    try {
      const url = `https://${cid}.ipfs.w3s.link`;
      const response = await axios.get(url, {
        responseType: "arraybuffer",
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(
        `Failed to retrieve file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get detailed metadata about a specific file
   */
  async getFileMetadata(cid: string, token: string): Promise<FileMetadata> {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const endpoint = this.BASE_URL.replace("{}", `status/${cid}`);
      const response = await axios.get(endpoint, { headers });

      if (response.status !== 200) {
        throw new Error(`Failed to get metadata: ${response.statusText}`);
      }

      return response.data as FileMetadata;
    } catch (error) {
      throw new Error(
        `Failed to get metadata: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a file from Web3.Storage (if supported by the service)
   */
  async deleteFile(cid: string, token: string): Promise<boolean> {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const endpoint = this.BASE_URL.replace("{}", `delete/${cid}`);
      const response = await axios.delete(endpoint, { headers });

      return response.status === 200;
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Upload multiple files at once
   */
  async uploadMultiple(
    filePaths: string[],
    token: string
  ): Promise<UploadResponse[]> {
    try {
      const formData = new FormData();

      for (const filePath of filePaths) {
        const fileContent = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        const mimeType = await fileType.fromBuffer(fileContent);
        formData.append(fileName, new Blob([fileContent]), fileName);
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const uploadEndpoint = this.BASE_URL.replace("{}", "upload");
      const response = await axios.post(uploadEndpoint, formData, { headers });

      if (response.status === 200) {
        return filePaths.map((filePath) => ({
          STATUS_CODE: 200,
          RESPONSE: JSON.stringify({
            fileName: path.basename(filePath),
            ...response.data,
          }),
        }));
      }

      throw new Error(`Upload failed with status: ${response.status}`);
    } catch (error) {
      return filePaths.map(() => ({
        RESPONSE:
          error instanceof Error ? error.message : "Unknown error occurred",
      }));
    }
  }

  /**
   * Check if a file exists by CID
   */
  async fileExists(cid: string): Promise<boolean> {
    try {
      const url = `https://${cid}.ipfs.w3s.link`;
      const response = await axios.head(url);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the total size of all uploads for a user
   */
  async getTotalStorageUsed(token: string): Promise<string> {
    try {
      const uploads = await this.userUploads(token);
      const data = JSON.parse(uploads);

      if (Array.isArray(data)) {
        const totalBytes = data.reduce(
          (acc, item) => acc + (item.size || 0),
          0
        );
        const sizeInGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
        return `${sizeInGB} GB`;
      }

      return "0 GB";
    } catch (error) {
      throw new Error(
        `Failed to get storage usage: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get file download URL
   */
  getFileUrl(cid: string): string {
    if (!utils.isValidCID(cid)) {
      throw new Error("Invalid CID format");
    }
    return `https://${cid}.ipfs.w3s.link`;
  }

  /**
   * Upload a file with retry mechanism
   */
  async uploadWithRetry(
    filePath: string,
    token: string,
    maxRetries: number = 3
  ): Promise<UploadResponse> {
    return utils.withRetry(() => this.upload(filePath, token), maxRetries);
  }

  /**
   * Get file size from CID
   */
  async getFileSize(cid: string): Promise<string> {
    try {
      const url = this.getFileUrl(cid);
      const response = await axios.head(url);
      const contentLength = response.headers["content-length"];
      const size = parseInt(contentLength, 10) || 0;
      return utils.formatFileSize(size);
    } catch (error) {
      throw new Error(
        `Failed to get file size: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if token is valid
   */
  async isValidToken(token: string): Promise<boolean> {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };
      const endpoint = this.BASE_URL.replace("{}", "user/uploads");
      const response = await axios.head(endpoint, { headers });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export default new Web3Storage();
