package com.example.backend.config;

import com.example.backend.service.DiagnosticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final DiagnosticsService diagnosticsService;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        diagnosticsService.sessionConnected();
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        diagnosticsService.sessionDisconnected();
    }
}
