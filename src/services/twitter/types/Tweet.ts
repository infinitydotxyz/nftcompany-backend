interface TweetPublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
}

export interface Tweet {
  /**
   * unique identifier of the tweet
   */
  id: string;

  /**
   *  UTF-8 text of the Tweet
   */
  text: string;

  /**
   * specifies the type of attachments (if any) present in this Tweet
   */
  attachments?: object[];

  /**
   * unique identifier of the User who posted this Tweet
   */
  author_id?: string;

  /**
   * contains context annotations for the Tweet
   */
  context_annotations?: object[];

  /**
   * Tweet ID of the original Tweet of the conversation
   */
  conversation_id?: string;

  /**
   * creation time of the Tweet
   *
   * ISO 8601 date
   */
  created_at?: string;

  /**
   * entities which have been parsed out of the text of the Tweet
   */
  entities?: object;

  /**
   * contains details about the location tagged by the user in this Tweet
   */
  geo?: object;

  /**
   * if the represented Tweet is a reply, this field will contain the original Tweet’s author ID
   */
  in_reply_to_user_id?: string;

  /**
   * language of the Tweet, if detected by Twitter. Returned as a BCP47 language tag
   */
  lang?: 'en' | string;

  /**
   * this field only surfaces when a Tweet contains a link
   * it is an indicator that the URL contained in the Tweet may contain content or media identified as sensitive content
   */
  possibly_sensitive?: boolean;

  /**
   * public engagement metrics for the Tweet at the time of the request
   */
  public_metrics?: TweetPublicMetrics;

  /**
   * a list of Tweets this Tweet refers to
   */
  referenced_tweets?: object[];

  /**
   * shows you who can reply to a given Tweet
   */
  reply_settings?: 'everyone' | 'mentioned_users' | 'followers';

  /**
   * the name of the app the user Tweeted from
   */
  source?: string;
}
