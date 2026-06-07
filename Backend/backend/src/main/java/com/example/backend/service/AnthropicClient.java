package com.example.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnthropicClient {

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-haiku-4-5-20251001}")
    private String model;

    /** Stronger model for the agentic copilot loop (tool use + reasoning). */
    @Value("${anthropic.agent-model:claude-sonnet-4-6}")
    private String agentModel;

    @Value("${anthropic.max-tokens:1024}")
    private int maxTokens;

    private final ObjectMapper objectMapper;
    private HttpClient httpClient;

    @PostConstruct
    public void init() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("ANTHROPIC_API_KEY not set — AI features will use rule-based fallbacks");
        }
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** Returns Claude's text response, or null if unavailable/error. */
    public String call(String userMessage) {
        return call(userMessage, maxTokens);
    }

    public String call(String userMessage, int tokens) {
        if (!isConfigured()) return null;
        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "model", model,
                    "max_tokens", tokens,
                    "messages", List.of(Map.of("role", "user", "content", userMessage))
            ));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.anthropic.com/v1/messages"))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Anthropic API returned {}: {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            return root.path("content").get(0).path("text").asText();
        } catch (Exception e) {
            log.error("Anthropic API call failed: {}", e.getMessage());
            return null;
        }
    }

    /** A tool the agent can call: given the tool name + JSON input, return a text result. */
    public interface ToolExecutor {
        String execute(String toolName, JsonNode input) throws Exception;
    }

    /**
     * Agentic loop with tool use. Sends the conversation + tool schemas to Claude;
     * whenever it asks for a tool, we run it (tenant-scoped, in the caller) and feed
     * the result back, repeating until Claude produces a final text answer or we hit
     * maxSteps. Returns the answer, or null if the API is unavailable/errors.
     */
    public String runAgent(String system, String userMessage, List<Map<String, Object>> tools,
                           ToolExecutor executor, int maxSteps, int tokens) {
        if (!isConfigured()) return null;
        try {
            List<Map<String, Object>> messages = new ArrayList<>();
            messages.add(Map.of("role", "user", "content", userMessage));

            for (int step = 0; step < maxSteps; step++) {
                Map<String, Object> reqBody = new LinkedHashMap<>();
                reqBody.put("model", agentModel);
                reqBody.put("max_tokens", tokens);
                if (system != null && !system.isBlank()) reqBody.put("system", system);
                reqBody.put("messages", messages);
                if (tools != null && !tools.isEmpty()) reqBody.put("tools", tools);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.anthropic.com/v1/messages"))
                        .header("x-api-key", apiKey)
                        .header("anthropic-version", "2023-06-01")
                        .header("content-type", "application/json")
                        .timeout(Duration.ofSeconds(60))
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(reqBody)))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) {
                    log.error("Anthropic agent API returned {}: {}", response.statusCode(), response.body());
                    return null;
                }

                JsonNode root = objectMapper.readTree(response.body());
                JsonNode content = root.path("content");
                String stopReason = root.path("stop_reason").asText();

                if (!"tool_use".equals(stopReason)) {
                    StringBuilder sb = new StringBuilder();
                    for (JsonNode block : content) {
                        if ("text".equals(block.path("type").asText())) sb.append(block.path("text").asText());
                    }
                    return sb.toString().trim();
                }

                // Echo the assistant's content (incl. the tool_use blocks) back into the convo.
                messages.add(Map.of("role", "assistant",
                        "content", objectMapper.convertValue(content, List.class)));

                // Run each requested tool and collect tool_result blocks.
                List<Map<String, Object>> toolResults = new ArrayList<>();
                for (JsonNode block : content) {
                    if (!"tool_use".equals(block.path("type").asText())) continue;
                    String toolName = block.path("name").asText();
                    String toolId = block.path("id").asText();
                    String result;
                    try {
                        result = executor.execute(toolName, block.path("input"));
                    } catch (Exception e) {
                        result = "Error running tool: " + e.getMessage();
                    }
                    Map<String, Object> tr = new LinkedHashMap<>();
                    tr.put("type", "tool_result");
                    tr.put("tool_use_id", toolId);
                    tr.put("content", result != null ? result : "(no data)");
                    toolResults.add(tr);
                }
                messages.add(Map.of("role", "user", "content", toolResults));
            }
            return "I gathered a lot but couldn't wrap it up in time — try asking something more specific.";
        } catch (Exception e) {
            log.error("Anthropic agent call failed: {}", e.getMessage());
            return null;
        }
    }
}
