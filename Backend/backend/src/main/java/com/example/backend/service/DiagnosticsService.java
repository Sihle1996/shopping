package com.example.backend.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Service
public class DiagnosticsService {

    private Instant restLastUpdate = Instant.now();
    private Instant websocketLastUpdate = Instant.EPOCH;
    private int activeSessions = 0;

    public synchronized void recordRestPing() {
        restLastUpdate = Instant.now();
    }

    public synchronized void recordWebsocketActivity() {
        websocketLastUpdate = Instant.now();
    }

    public synchronized void sessionConnected() {
        activeSessions++;
        recordWebsocketActivity();
    }

    public synchronized void sessionDisconnected() {
        if (activeSessions > 0) {
            activeSessions--;
        }
        recordWebsocketActivity();
    }

    public Map<String, Object> healthSnapshot() {
        Map<String, Object> rest = Map.of(
                "status", "UP",
                "lastUpdate", restLastUpdate.toString()
        );

        String wsStatus = activeSessions > 0 ? "UP" : "DOWN";
        Map<String, Object> websocket = Map.of(
                "status", wsStatus,
                "lastUpdate", websocketLastUpdate.toString()
        );

        return Map.of(
                "rest", rest,
                "websocket", websocket
        );
    }
}
