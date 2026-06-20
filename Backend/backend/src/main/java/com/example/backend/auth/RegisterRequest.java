package com.example.backend.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;

public class RegisterRequest {
    @Email(message = "Invalid email format")
    @NotEmpty(message = "Email is required")
    private String email;

    @NotEmpty(message = "Password is required")
    private String password;

    public RegisterRequest() {}
    public RegisterRequest(String email, String password) { this.email = email; this.password = password; }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }
}
