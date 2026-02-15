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
  answer_type?: 'multiple_choice' | 'free_text';
  hint?: string;
}

export interface CreateQuestionSetData {
  name: string;
  description?: string;
  category?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions?: Omit<CreateQuestionData, 'question_set_id'>[];
}

