package com.example.backend.repository;


import com.example.backend.user.DriverStatus;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    List<User> findByRoleAndDriverStatus(Role role, DriverStatus driverStatus);
    List<User> findByRole(Role role);
}
