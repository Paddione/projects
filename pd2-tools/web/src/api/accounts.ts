import { apiClient } from "./client";

interface QueueAccountResponse {
  message: string;
  accountName: string;
  estimatedSeconds: number;
  queuePosition: number;
}

export const accountsAPI = {
  /**
   * Add account to priority scrape queue
   */
  async queueAccount(accountName: string): Promise<QueueAccountResponse> {
    return apiClient.post<QueueAccountResponse>("/accounts/queue", {
      accountName,
    });
  },
};
