export interface FeedbackReplyDto {
  body: string;
  createdAt: string;
  repliedByUsername: string;
}

export interface FeedbackDto {
  id: string;
  subject: string;
  details: string;
  imageUrl: string | null;
  createdAt: string;
  submittedByName: string;
  reply: FeedbackReplyDto | null; // null = unanswered (red), set = answered (blue)
}

export interface CreateFeedbackPayload {
  subject: string;
  details: string;
  imageUrl?: string | null;
}
