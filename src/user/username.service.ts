import { firestoreConstants, trimLowerCase } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { FirebaseService } from 'firebase/firebase.service';

@Injectable()
export class UsernameService {
  private readonly MIN_USERNAME_CHARS = 5;
  private readonly MAX_USERNAME_CHARS = 15;
  private readonly usernameChars = '[a-zA-Z0-9_]';
  private readonly usernameCharRegex = new RegExp(`[^${this.usernameChars}]`, 'g');
  private readonly usernameRegex = new RegExp(
    `^${this.usernameChars}{${this.MIN_USERNAME_CHARS},${this.MAX_USERNAME_CHARS}}$`
  );

  constructor(private firebaseService: FirebaseService) {}

  static normalizeUsername(username: string) {
    return trimLowerCase(username);
  }

  private stripInvalidCharacters(username: string) {
    return username.replace(this.usernameCharRegex, '');
  }

  validateUsername(username: string) {
    const MIN_USERNAME_CHARS = 5;
    const MAX_USERNAME_CHARS = 15;

    if (username.length < MIN_USERNAME_CHARS) {
      return {
        username,
        isValid: false,
        reason: `Username must be at least ${MIN_USERNAME_CHARS} characters long`
      };
    }

    if (username.length > MAX_USERNAME_CHARS) {
      return {
        username,
        isValid: false,
        reason: `Username must be at most ${MAX_USERNAME_CHARS} characters long`
      };
    }

    if (!this.usernameRegex.test(username)) {
      return {
        username,
        isValid: false,
        reason: `Username must only contain alphanumeric characters and underscores`
      };
    }

    return {
      username,
      isValid: true
    };
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();
    const usersCollection = this.firebaseService.firestore.collection(firestoreConstants.USERS_COLL);

    const snapshot = await usersCollection.where('username', '==', normalizedUsername).get();

    return snapshot.empty;
  }

  async getSuggestions(username: string): Promise<string[]> {
    const normalizedUsername = UsernameService.normalizeUsername(username);
    let stripped = this.stripInvalidCharacters(normalizedUsername);

    const randomCharLength = 3;

    if (stripped.length < this.MIN_USERNAME_CHARS) {
      const randomInts = Array.from({ length: this.MIN_USERNAME_CHARS - stripped.length }, () => randomInt(0, 9));
      stripped = `${stripped}${randomInts.join('')}`;
    }

    if (stripped.length > this.MAX_USERNAME_CHARS - randomCharLength) {
      stripped = stripped.slice(0, this.MAX_USERNAME_CHARS - randomCharLength);
    }

    const suggestions = [];
    for (let x = 0; x < 10; x += 1) {
      const randomInts = Array.from({ length: randomCharLength }, () => randomInt(0, 9));
      suggestions.push(`${stripped}${randomInts.join('')}`);
    }

    const usersCollection = this.firebaseService.firestore.collection(firestoreConstants.USERS_COLL);

    const snapshot = await usersCollection.where('username', 'in', suggestions).get();

    const existing = new Set(snapshot.docs.map((doc) => doc.data().username));

    const availableSuggestions = suggestions.filter((suggestion) => !existing.has(suggestion));

    return availableSuggestions;
  }
}
