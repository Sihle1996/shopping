package com.example.backend.auth;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AuthenticationResponse {

    private String token;
    private String message;

    public AuthenticationResponse(String token) {
        this.token = token;
    }

    public static AuthenticationResponseBuilder builder() {
        return new AuthenticationResponseBuilder();
    }

    public static class AuthenticationResponseBuilder {
        private String token;
        private String message;

        public AuthenticationResponseBuilder token(String token) {
            this.token = token;
            return this;
        }

        public AuthenticationResponseBuilder message(String message) {
            this.message = message;
            return this;
        }

        public AuthenticationResponse build() {
            AuthenticationResponse r = new AuthenticationResponse(token);
            r.setMessage(message);
            return r;
        }
    }
}
