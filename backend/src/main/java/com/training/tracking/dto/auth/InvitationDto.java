package com.training.tracking.dto.auth;

/** Fills the accept screen in, so the invited person sees which account they are claiming. */
public record InvitationDto(String email, String displayName) {
}
