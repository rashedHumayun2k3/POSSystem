import { api } from './api';
import type { FeedbackDto, CreateFeedbackPayload } from '@/types/feedback';

export const listMyFeedback = async (): Promise<FeedbackDto[]> => {
  const { data } = await api.get('/feedback');
  return data;
};

export const createFeedback = async (payload: CreateFeedbackPayload): Promise<FeedbackDto> => {
  const { data } = await api.post('/feedback', payload);
  return data;
};
