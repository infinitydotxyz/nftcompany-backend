import { firestoreConstants } from '@infinityxyz/lib/utils';
import { trimLowerCase } from '@infinityxyz/lib/utils/formatters';
import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { FirebaseService } from 'firebase/firebase.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { ParsedUserId } from './user-id.pipe';

@Injectable()
export class ProfileService {
  public static readonly MIN_USERNAME_CHARS = 5;
  public static readonly MAX_USERNAME_CHARS = 15;
  public static readonly MAX_DISPLAY_NAME_CHARS = 50;
  public static readonly MAX_BIO_CHARS = 160;
  private readonly usernameChars = '[a-zA-Z0-9_]';
  private readonly usernameCharRegex = new RegExp(`[^${this.usernameChars}]`, 'g');
  private readonly usernameRegex = new RegExp(
    `^${this.usernameChars}{${ProfileService.MIN_USERNAME_CHARS},${ProfileService.MAX_USERNAME_CHARS}}$`
  );

  constructor(private firebaseService: FirebaseService) {}

  static normalizeUsername(username: string) {
    return trimLowerCase(username);
  }

  static validateDisplayName(displayName: string) {
    if (displayName.length > ProfileService.MAX_DISPLAY_NAME_CHARS) {
      return {
        displayName,
        isValid: false,
        reason: `Display name must be at most ${ProfileService.MAX_DISPLAY_NAME_CHARS} characters long`
      };
    }

    return {
      displayName,
      isValid: true
    };
  }

  static validateBio(bio: string) {
    if (bio.length > ProfileService.MAX_BIO_CHARS) {
      return {
        bio,
        isValid: false,
        reason: `Bio must be at most ${ProfileService.MAX_BIO_CHARS} characters long`
      };
    }

    return {
      bio,
      isValid: true
    };
  }

  async updateProfile(user: ParsedUserId, data: Partial<UserProfileDto> & UpdateUserProfileDto) {
    const profileSnap = await user.ref.get();
    const currentProfile = profileSnap.data();
    const createdAt = currentProfile?.createdAt ?? Date.now();
    const updatedAt = Date.now();
    const { deleteProfileImage, deleteBannerImage, ...updatedProfile } = data;

    const { isValid: isBioValid, reason: bioInvalidReason } = ProfileService.validateBio(data.bio);
    if (!isBioValid) {
      throw new Error(bioInvalidReason);
    }

    const { isValid: isDisplayNameValid, reason: displayNameInvalidReason } = ProfileService.validateDisplayName(
      data.displayName
    );
    if (!isDisplayNameValid) {
      throw new Error(displayNameInvalidReason);
    }

    const canClaimUsername = await this.canClaimUsername(data.username, currentProfile ?? {});
    if (!canClaimUsername) {
      throw new Error(`Username ${data.username} is invalid or already taken`);
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

  private async canClaimUsername(newUsername: string, currentUser: Partial<UserProfileDto>): Promise<boolean> {
    const normalizedUsername = ProfileService.normalizeUsername(newUsername);
    if (normalizedUsername === currentUser.username) {
      return true;
    }

    const isValid = this.validateUsername(normalizedUsername);

    if (!isValid) {
      return false;
    }

    const usernameAvailable = await this.isAvailable(normalizedUsername);

    return usernameAvailable;
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

  async isAvailable(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();
    const usersCollection = this.firebaseService.firestore.collection(firestoreConstants.USERS_COLL);

    const snapshot = await usersCollection.where('username', '==', normalizedUsername).get();

    return snapshot.empty;
  }

  async getSuggestions(username: string): Promise<string[]> {
    const normalizedUsername = ProfileService.normalizeUsername(username);
    let stripped = this.stripInvalidCharacters(normalizedUsername);

    const randomCharLength = 3;

    if (stripped.length < ProfileService.MIN_USERNAME_CHARS) {
      const randomInts = Array.from({ length: ProfileService.MIN_USERNAME_CHARS - stripped.length }, () =>
        randomInt(0, 9)
      );
      stripped = `${stripped}${randomInts.join('')}`;
    }

    if (stripped.length > ProfileService.MAX_USERNAME_CHARS - randomCharLength) {
      stripped = stripped.slice(0, ProfileService.MAX_USERNAME_CHARS - randomCharLength);
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
    return username.replace(this.usernameCharRegex, '');
  }
}
