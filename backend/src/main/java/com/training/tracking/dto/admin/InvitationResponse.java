package com.training.tracking.dto.admin;

/**
 * @param invitationUrl the link to pass on by hand, present only when it could not be mailed. The
 *                      token is stored hashed, so this response is the only time it can be shown.
 */
public record InvitationResponse(AdminUserDto user, String invitationUrl) {
}
