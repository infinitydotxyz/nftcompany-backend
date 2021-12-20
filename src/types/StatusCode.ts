export enum StatusCode {
  /**
   * The request succeeded
   */
  Ok = 200,
  /**
   * The request succeeded, and a new resource was created
   */
  Created = 201,
  /**
   * The request has been received but not yet acted upon
   */
  Accepted = 202,

  /**
   * intended for cases where another process or server handles the request
   */
  NonAuthoritativeInfo = 203,

  /**
   * There is no content to send for this request
   */
  NoContent = 204,

  /**
   * The request has more than one possible response. The user agent or user should choose one of them
   */
  MultipleChoice = 300,

  /**
   * The URL of the requested resource has been changed permanently. The new URL is given in the response.
   */
  MovedPermanently = 301,

  /**
   * This response code means that the URI of requested resource has been changed temporarily.
   */
  Found = 302,

  /**
   * The server sent this response to direct the client to get the requested resource at another URI with a GET request.
   */
  SeeOther = 303,

  /**
   * This is used for caching purposes. It tells the client that the response has not been modified
   */
  NotModified = 304,

  /**
   * The server could not understand the request due to invalid syntax.
   */
  BadRequest = 400,

  /**
   * Although the HTTP standard specifies "unauthorized", semantically this response means "unauthenticated".
   */
  Unauthorized = 401,

  /**
   * The client does not have access rights to the content (i.e. unauthorized)
   * Unlike 401 Unauthorized, the client's identity is known to the server.
   */
  Forbidden = 403,

  /**
   * The server can not find the requested resource
   */
  NotFound = 404,

  /**
   * The request method is known by the server but is not supported by the target resource
   */
  MethodNotAllowed = 405,

  /**
   * This response is sent when the requested content has been permanently deleted from server, with no forwarding address
   */
  Gone = 410,

  /**
   * The user has sent too many requests in a given amount of time
   */
  TooManyRequests = 429,

  /**
   * The server has encountered a situation it does not know how to handle
   */
  InternalServerError = 500,

  /**
   * The request method is not supported by the server and cannot be handled
   */
  NotImplemented = 501
}
