export interface ValidUsername {
  isValid: true;
  username: string;
}

export interface InvalidUsername {
  isValid: false;
  username: string;
  reason: string;
}

export type UsernameType = ValidUsername | InvalidUsername;
