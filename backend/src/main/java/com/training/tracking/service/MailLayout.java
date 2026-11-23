package com.training.tracking.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Renders a {@link MailContent} as the HTML part (from {@code mail/layout.html}, dark like the app)
 * and as the matching plain-text part.
 */
@Component
public class MailLayout {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(\\w+)}}");
    private static final List<String> FOOTER = List.of(
            "Diese E-Mail wurde automatisch von Training versendet.",
            "Antworten an diese Adresse werden nicht gelesen.");

    private final String template;
    private final String codeTemplate;
    private final String buttonTemplate;
    private final String contact;

    public MailLayout(@Value("${app.mail.contact:}") String contact) {
        this.contact = contact;
        template = load("mail/layout.html");
        codeTemplate = load("mail/code.html");
        buttonTemplate = load("mail/button.html");
    }

    public String html(MailContent content) {
        Map<String, String> values = Map.of(
                "subject", escape(content.subject()),
                "heading", escape(content.heading()),
                "paragraphs", content.paragraphs().stream()
                        .map(p -> "<p style=\"margin:0 0 16px;\">" + escape(p) + "</p>")
                        .collect(Collectors.joining("\n")),
                "highlight", htmlHighlight(content.highlight()),
                "validity", escape(content.validity()),
                "note", escape(content.note()),
                "footer", htmlFooter());
        return fill(template, values);
    }

    public String text(MailContent content) {
        StringBuilder text = new StringBuilder("TRAINING\n").append(content.heading()).append("\n\n");
        content.paragraphs().forEach(p -> text.append(p).append("\n\n"));
        text.append(switch (content.highlight()) {
            case MailContent.Code code -> "    " + code.value();
            case MailContent.Button button -> button.label() + ":\n" + button.url();
        }).append("\n\n")
                .append(content.validity()).append("\n\n")
                .append(content.note()).append("\n\n")
                .append("--\n");
        FOOTER.forEach(line -> text.append(line).append('\n'));
        if (StringUtils.hasText(contact)) {
            text.append("Bei Fragen schreib an ").append(contact).append(".\n");
        }
        return text.toString();
    }

    private String htmlHighlight(MailContent.Highlight highlight) {
        return switch (highlight) {
            case MailContent.Code code -> fill(codeTemplate, Map.of("code", escape(code.value())));
            case MailContent.Button button -> fill(buttonTemplate,
                    Map.of("label", escape(button.label()), "url", escape(button.url())));
        };
    }

    /** One pass, so a value that happens to contain {{…}} is never substituted again. */
    private static String fill(String template, Map<String, String> values) {
        return PLACEHOLDER.matcher(template).replaceAll(match -> {
            String value = values.get(match.group(1));
            if (value == null) {
                throw new IllegalStateException("mail template has no value for " + match.group());
            }
            return Matcher.quoteReplacement(value);
        });
    }

    private static String load(String path) {
        try {
            return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String htmlFooter() {
        String footer = FOOTER.stream().map(MailLayout::escape).collect(Collectors.joining("<br>"));
        if (!StringUtils.hasText(contact)) {
            return footer;
        }
        String address = escape(contact);
        return footer + "<br>Bei Fragen schreib an <a href=\"mailto:" + address
                + "\" style=\"color:#f2c14e;\">" + address + "</a>.";
    }

    private static String escape(String value) {
        return HtmlUtils.htmlEscape(value, StandardCharsets.UTF_8.name());
    }
}
