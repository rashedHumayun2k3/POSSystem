import { api } from './api';

export interface ExternalOrderIntegration {
  id: string;
  name: string;
  sourceWebsiteUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateExternalOrderIntegrationResponse {
  id: string;
  name: string;
  apiKey: string;
  sourceWebsiteUrl: string | null;
  isActive: boolean;
}

export const listExternalOrderIntegrations = async (): Promise<ExternalOrderIntegration[]> => {
  const { data } = await api.get('/businesses/external-order-integrations');
  return data;
};

export const createExternalOrderIntegration = async (payload: {
  name: string;
  sourceWebsiteUrl?: string | null;
}): Promise<CreateExternalOrderIntegrationResponse> => {
  const { data } = await api.post('/businesses/external-order-integrations', payload);
  return data;
};

export const setExternalOrderIntegrationActive = async (id: string, isActive: boolean): Promise<void> => {
  await api.patch(`/businesses/external-order-integrations/${id}/active`, { isActive });
};

export const deleteExternalOrderIntegration = async (id: string): Promise<void> => {
  await api.delete(`/businesses/external-order-integrations/${id}`);
};
