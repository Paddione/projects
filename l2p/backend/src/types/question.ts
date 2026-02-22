export type AnswerType =
  | 'multiple_choice'
  | 'free_text'
  | 'true_false'
  | 'estimation'
  | 'ordering'
  | 'matching'
  | 'fill_in_blank';

export interface EstimationMetadata {
  correct_value: number;
  tolerance: number;
  tolerance_type: 'absolute' | 'percentage';
}

export interface OrderingMetadata {
  items: string[];
  correct_order: number[];
}

export interface MatchingMetadata {
  pairs: Array<{ left: string; right: string }>;
}

export interface FillInBlankMetadata {
  template: string;
  blanks: string[];
}

export type AnswerMetadata =
  | EstimationMetadata
  | OrderingMetadata
  | MatchingMetadata
  | FillInBlankMetadata;

export interface Answer {
  id?: number;
  question_id?: number;
  text: string;
  correct: boolean;
  created_at?: Date;
}

export interface Question {
  id: number;
  question_set_id: number;
  question_text: string;
  answers: Answer[];
  explanation?: string;
  difficulty: number;
  created_at: Date;
  answer_count?: number;
  answer_type?: AnswerType;
  hint?: string;
  answer_metadata?: AnswerMetadata;
}

export interface QuestionSet {
  id: number;
  name: string;
  description?: string;
  category?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  questions?: Question[];
}

export interface QuestionSetWithQuestions extends QuestionSet {
  questions: Question[];
}


export interface CreateQuestionData {
  question_set_id: number;
  question_text: string;
  answers: Omit<Answer, 'id' | 'question_id' | 'created_at'>[];
  explanation?: string;
  difficulty?: number;
  answer_type?: AnswerType;
  hint?: string;
  answer_metadata?: AnswerMetadata;
}

export interface CreateQuestionSetData {
  name: string;
  description?: string;
  category?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions?: Omit<CreateQuestionData, 'question_set_id'>[];
}
