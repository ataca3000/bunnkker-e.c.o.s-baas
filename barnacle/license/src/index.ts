import axios from 'axios';

interface LicenseValidationResponse {
  valid: boolean;
  active: boolean;
  trial_days_remaining?: number;
  subscription_ends_at?: string;
}

export class BarnacleValidator {
  private backendUrl: string;
  private apiKey: string;

  constructor(backendUrl: string, apiKey: string) {
    this.backendUrl = backendUrl;
    this.apiKey = apiKey;
  }

  async validate(licenseId: string, userId: string): Promise<LicenseValidationResponse> {
    try {
      const response = await axios.post(
        `${this.backendUrl}/api/licenses/validate`,
        { license_id: licenseId, user_id: userId },
        { headers: { Authorization: `Bearer ${this.apiKey}` } }
      );

      return response.data;
    } catch (error) {
      console.error('License validation failed:', error);
      return { valid: false, active: false };
    }
  }

  async checkTrial(licenseId: string): Promise<number> {
    const validation = await this.validate(licenseId, '');
    return validation.trial_days_remaining || 0;
  }
}

export default BarnacleValidator;
