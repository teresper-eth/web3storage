import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import fileType from "file-type";

interface UploadResponse {
  STATUS_CODE?: number;
  RESPONSE: string;
}

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
}

export default new Web3Storage();
