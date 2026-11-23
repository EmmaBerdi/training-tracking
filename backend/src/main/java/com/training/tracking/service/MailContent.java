package com.training.tracking.service;

import java.util.List;

/**
 * One mail in the app's layout ({@link MailLayout}): a heading, paragraphs, the highlighted code
 * with how long it holds, and a closing note in small print. Plain text throughout; the layout
 * escapes it for the HTML part.
 */
public record MailContent(String subject,
                          String heading,
                          List<String> paragraphs,
                          String code,
                          String validity,
                          String note) {
}
