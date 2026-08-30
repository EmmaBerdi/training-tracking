package com.training.tracking.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

import java.time.LocalDate;

/** A date a rule must not generate: the occurrence was deleted on its own, or moved elsewhere. */
@Entity
@Table(name = "recurring_rule_exception")
public class RecurringRuleException {

    @EmbeddedId
    private RecurringRuleExceptionId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("ruleId")
    @JoinColumn(name = "rule_id")
    private RecurringRule rule;

    public RecurringRuleException() { }

    public RecurringRuleException(RecurringRule rule, LocalDate excludedDate) {
        this.rule = rule;
        this.id = new RecurringRuleExceptionId(rule.getId(), excludedDate);
    }

    public RecurringRuleExceptionId getId() { return id; }
    public void setId(RecurringRuleExceptionId id) { this.id = id; }

    public RecurringRule getRule() { return rule; }
    public void setRule(RecurringRule rule) { this.rule = rule; }
}
