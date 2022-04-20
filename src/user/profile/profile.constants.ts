/**
 * username constraints
 */
export const MIN_USERNAME_CHARS = 5;
export const MAX_USERNAME_CHARS = 14;
export const usernameChars = '[a-zA-Z0-9_]';
export const usernameCharRegex = new RegExp(`[^${usernameChars}]`, 'g');
export const usernameRegex = new RegExp(`^${usernameChars}{${MIN_USERNAME_CHARS},${MAX_USERNAME_CHARS}}$`);
const supportedChars = 'alphanumeric characters and underscores';
export const usernameConstraints = `Username must be between ${MIN_USERNAME_CHARS} and ${MAX_USERNAME_CHARS} characters long and can contain only ${supportedChars}`;

/**
 * display name constraints
 */
export const MAX_DISPLAY_NAME_CHARS = 50;

/**
 * bio constraints
 */
export const MAX_BIO_CHARS = 160;
