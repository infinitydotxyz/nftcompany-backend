interface UserPublicMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count: number;
}

export interface User {
  /**
   * the unique identifier of this user
   */
  id: string;

  /**
   * the name of the user, as they’ve defined it on their profile
   */
  name: string;

  /**
   * the Twitter screen name, handle, or alias that this user identifies themselves with
   */
  username: string;

  /**
   * creation time of the account
   *
   * ISO 8601 date
   */
  created_at?: string;

  /**
   * the text of this user's profile description (bio)
   */
  description?: string;

  /**
   * contains details about text that has a special meaning in the user's description
   */
  entities?: object;

  /**
   * the location specified in the user's profile
   */
  location?: string;

  /**
   * unique identifier of this user's pinned Tweet
   */
  pinned_tweet_id?: string;

  /**
   * the URL to the profile image for this user, as shown on the user's profile.
   */
  profile_image_url?: string;

  /**
   * indicates if this user has chosen to protect their Tweets
   */
  protected?: boolean;

  /**
   * contains details about activity for this user.
   */
  public_metrics?: UserPublicMetrics;

  /**
   * the URL specified in the user's profile, if present.
   */
  url?: string;

  /**
   * indicates if this user is a verified Twitter User
   */
  verified?: boolean;
}
