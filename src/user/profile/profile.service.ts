import { firestoreConstants } from '@infinityxyz/lib/utils';
import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { FirebaseService } from 'firebase/firebase.service';
import { UpdateUserProfileDto } from '../dto/update-user-profile.dto';
import { UserProfileDto } from '../dto/user-profile.dto';
import { InvalidProfileError } from '../errors/invalid-profile.error';
import { ParsedUserId } from '../user-id.pipe';
import { MAX_USERNAME_CHARS, MIN_USERNAME_CHARS, usernameCharRegex, usernameRegex } from './profile.constants';

@Injectable()
export class ProfileService {
  constructor(private firebaseService: FirebaseService) {}

  static isValidUsername(value: string) {
    if (typeof value !== 'string') {
      return false;
    }
    const isValid = usernameRegex.test(value);
    return isValid;
  }

  async updateProfile(user: ParsedUserId, data: Partial<UserProfileDto> & UpdateUserProfileDto) {
    const profileSnap = await user.ref.get();
    const currentProfile = profileSnap.data();
    const createdAt = currentProfile?.createdAt ?? Date.now();
    const updatedAt = Date.now();
    const { deleteProfileImage, deleteBannerImage, ...updatedProfile } = data;

    const canClaimUsername = await this.canClaimUsername(data.username, currentProfile ?? {});
    if (!canClaimUsername) {
      throw new InvalidProfileError(`Username ${data.username} is invalid or already taken`);
    }

    const profile = {
      ...currentProfile,
      ...updatedProfile,
      address: user.userAddress,
      createdAt,
      updatedAt
    };

    if (deleteProfileImage) {
      profile.profileImage = '';
    }

    if (deleteBannerImage) {
      profile.bannerImage = '';
    }

    await user.ref.set(profile, { merge: true });
  }

  async isAvailable(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();
    const usersCollection = this.firebaseService.firestore.collection(firestoreConstants.USERS_COLL);

    const snapshot = await usersCollection.where('username', '==', normalizedUsername).get();

    return snapshot.empty;
  }

  async getSuggestions(username: string): Promise<string[]> {
    let stripped = this.stripInvalidCharacters(username);
    const randomCharLength = 3;

    if (stripped.length < MIN_USERNAME_CHARS) {
      const randomInts = Array.from({ length: MIN_USERNAME_CHARS - stripped.length }, () => randomInt(0, 9));
      stripped = `${stripped}${randomInts.join('')}`;
    }

    if (stripped.length > MAX_USERNAME_CHARS - randomCharLength) {
      stripped = stripped.slice(0, MAX_USERNAME_CHARS - randomCharLength);
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

  private stripInvalidCharacters(username: string) {
    return username.replace(usernameCharRegex, '');
  }

  private async canClaimUsername(newUsername: string, currentUser: Partial<UserProfileDto>): Promise<boolean> {
    if (newUsername === currentUser.username) {
      return true;
    }

    const usernameAvailable = await this.isAvailable(newUsername);

    return usernameAvailable;
  }
}
