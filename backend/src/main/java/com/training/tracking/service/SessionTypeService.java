package com.training.tracking.service;

import com.training.tracking.domain.SessionType;
import com.training.tracking.dto.CreateSessionTypeRequest;
import com.training.tracking.dto.SessionTypeDto;
import com.training.tracking.repository.DayRepository;
import com.training.tracking.repository.PlannedSessionRepository;
import com.training.tracking.repository.RecurringRuleRepository;
import com.training.tracking.repository.SessionTypeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class SessionTypeService {

    private final SessionTypeRepository sessionTypeRepository;
    private final PlannedSessionRepository plannedSessionRepository;
    private final RecurringRuleRepository recurringRuleRepository;
    private final DayRepository dayRepository;

    public SessionTypeService(SessionTypeRepository sessionTypeRepository,
                               PlannedSessionRepository plannedSessionRepository,
                               RecurringRuleRepository recurringRuleRepository,
                               DayRepository dayRepository) {
        this.sessionTypeRepository = sessionTypeRepository;
        this.plannedSessionRepository = plannedSessionRepository;
        this.recurringRuleRepository = recurringRuleRepository;
        this.dayRepository = dayRepository;
    }

    @Transactional(readOnly = true)
    public List<SessionTypeDto> listTypes(Long userId) {
        return sessionTypeRepository.findAllByUserIdIsNullOrUserId(userId).stream()
                .map(SessionTypeService::toDto)
                .toList();
    }

    @Transactional
    public SessionTypeDto createCustomType(Long userId, CreateSessionTypeRequest request) {
        if (sessionTypeRepository.existsByUserIdAndLabelIgnoreCase(userId, request.label())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "a session type with this label already exists");
        }
        SessionType type = new SessionType();
        type.setUserId(userId);
        type.setLabel(request.label());
        type.setColor(request.color());
        type.setIcon(request.icon());
        type.setCreatedAt(Instant.now());
        sessionTypeRepository.save(type);
        return toDto(type);
    }

    @Transactional
    public void deleteCustomType(Long userId, Long typeId) {
        SessionType type = sessionTypeRepository.findById(typeId)
                .orElseThrow(SessionTypeService::notFound);
        if (type.getUserId() == null || !type.getUserId().equals(userId)) {
            throw notFound();
        }
        if (plannedSessionRepository.countBySessionTypeId(typeId) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "session type is still referenced by a planned session");
        }
        if (recurringRuleRepository.countBySessionTypeId(typeId) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "session type is still referenced by a recurring rule");
        }
        if (dayRepository.countBySessionTypeId(typeId) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "session type is still referenced by a workout plan");
        }
        sessionTypeRepository.delete(type);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "session type not found");
    }

    private static SessionTypeDto toDto(SessionType type) {
        return new SessionTypeDto(type.getId(), type.getLabel(), type.getColor(), type.getIcon(),
                type.getUserId() != null);
    }
}
