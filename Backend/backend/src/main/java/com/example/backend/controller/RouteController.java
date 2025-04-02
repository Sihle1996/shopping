package com.example.backend.controller;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/api/map")
@CrossOrigin(origins = "http://localhost:4200") // ✅ Allow frontend requests
public class RouteController {

    private static final String ORS_API_KEY = "5b3ce3597851110001cf62486eb46190526c4d34b70f6499f1ba52c2";

    @PostMapping("/route")
    public ResponseEntity<?> getRoute(@RequestBody Map<String, Object> payload) {
        String url = "https://api.openrouteservice.org/v2/directions/driving-car";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(ORS_API_KEY); // ✅ cleaner method

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    String.class
            );
            return ResponseEntity.ok(response.getBody());
        } catch (HttpStatusCodeException ex) {
            return ResponseEntity
                    .status(ex.getStatusCode())
                    .body("❌ ORS Error: " + ex.getResponseBodyAsString());
        }
    }
}
