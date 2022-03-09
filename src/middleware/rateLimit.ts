import { trimLowerCase } from '@infinityxyz/lib/utils';
import rateLimit from 'express-rate-limit';

export const postUserRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // limit each user's address to 200 requests per windowMs
  keyGenerator: function (req, res) {
    // uses user's address as key for rate limiting
    return trimLowerCase(req.params.user);
  }
});

export const getUserRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // limit each user's address to 200 requests per windowMs
  keyGenerator: function (req, res) {
    // uses user's address as key for rate limiting
    return trimLowerCase(req.params.user);
  }
});

// rate limit for lower frequent calls (setEmail, subscribeEmail, etc.)
export const lowRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each user's address to 5 requests per windowMs
  keyGenerator: function (req, res) {
    // uses user's address as key for rate limiting
    return trimLowerCase(req.params.user);
  }
});
