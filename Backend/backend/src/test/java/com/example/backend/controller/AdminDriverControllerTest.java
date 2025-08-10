package com.example.backend.controller;

import com.example.backend.auth.RegisterRequest;
import com.example.backend.service.AdminDriverService;
import com.example.backend.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminDriverController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminDriverControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminDriverService adminDriverService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void createDriverReturnsCreatedDriver() throws Exception {
        User driver = User.builder().id(1L).email("driver@example.com").build();
        when(adminDriverService.createDriver(any(RegisterRequest.class))).thenReturn(driver);

        mockMvc.perform(post("/api/admin/drivers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"driver@example.com\",\"password\":\"pass\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("driver@example.com"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getAllDriversReturnsList() throws Exception {
        List<User> drivers = List.of(User.builder().id(1L).email("a@b.com").build());
        when(adminDriverService.getAllDrivers()).thenReturn(drivers);

        mockMvc.perform(get("/api/admin/drivers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("a@b.com"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void deleteDriverCallsService() throws Exception {
        mockMvc.perform(delete("/api/admin/drivers/1"))
                .andExpect(status().isOk());

        verify(adminDriverService).deleteDriver(1L);
    }
}

