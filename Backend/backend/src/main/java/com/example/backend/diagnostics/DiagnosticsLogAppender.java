package com.example.backend.diagnostics;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import com.example.backend.service.DiagnosticsService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class DiagnosticsLogAppender extends AppenderBase<ILoggingEvent> {

    private final SimpMessagingTemplate messagingTemplate;
    private final DiagnosticsService diagnosticsService;

    @PostConstruct
    public void init() {
        Logger rootLogger = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        rootLogger.addAppender(this);
        this.start();
    }

    @Override
    protected void append(ILoggingEvent eventObject) {
        diagnosticsService.recordWebsocketActivity();
        Map<String, Object> payload = Map.of(
                "timestamp", Instant.ofEpochMilli(eventObject.getTimeStamp()).toString(),
                "level", eventObject.getLevel().toString(),
                "message", eventObject.getFormattedMessage()
        );
        messagingTemplate.convertAndSend("/topic/diagnostics", payload);
    }
}
