package com.example.backend.repository;


import com.example.backend.user.DriverStatus;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    List<User> findByRoleAndDriverStatus(Role role, DriverStatus driverStatus);
    List<User> findByRole(Role role);
    Optional<User> findByEmailAndTenant_Id(String email, UUID tenantId);
    Optional<User> findByEmailAndTenantIsNull(String email);
    List<User> findByRoleAndDriverStatusAndTenant_Id(Role role, DriverStatus driverStatus, UUID tenantId);
    List<User> findByRoleAndTenant_Id(Role role, UUID tenantId);
    long countByRoleAndTenant_Id(Role role, UUID tenantId);
}
