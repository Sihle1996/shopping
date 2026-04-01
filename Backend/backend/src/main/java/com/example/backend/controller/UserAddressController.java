package com.example.backend.controller;

import com.example.backend.config.AuthUtil;
import com.example.backend.entity.UserAddress;
import com.example.backend.repository.UserAddressRepository;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/addresses")
@RequiredArgsConstructor
public class UserAddressController {

    private final UserAddressRepository addressRepository;
    private final AuthUtil authUtil;

    @GetMapping
    public List<AddressResponse> list(Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        return addressRepository.findByUserId(user.getId())
                .stream().map(AddressResponse::from).toList();
    }

    @PostMapping
    public ResponseEntity<AddressResponse> create(
            @RequestBody AddressRequest req,
            Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        if (req.isDefault()) {
            // clear existing defaults
            addressRepository.findByUserId(user.getId()).forEach(a -> {
                a.setDefault(false);
                addressRepository.save(a);
            });
        }
        UserAddress address = UserAddress.builder()
                .user(user)
                .label(req.label())
                .street(req.street())
                .city(req.city())
                .postalCode(req.postalCode())
                .latitude(req.latitude())
                .longitude(req.longitude())
                .isDefault(req.isDefault())
                .build();
        return ResponseEntity.ok(AddressResponse.from(addressRepository.save(address)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AddressResponse> update(
            @PathVariable UUID id,
            @RequestBody AddressRequest req,
            Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        UserAddress address = addressRepository.findById(id).orElse(null);
        if (address == null || !address.getUser().getId().equals(user.getId()))
            return ResponseEntity.notFound().build();

        if (req.isDefault()) {
            addressRepository.findByUserId(user.getId()).forEach(a -> {
                a.setDefault(false);
                addressRepository.save(a);
            });
        }
        address.setLabel(req.label());
        address.setStreet(req.street());
        address.setCity(req.city());
        address.setPostalCode(req.postalCode());
        address.setLatitude(req.latitude());
        address.setLongitude(req.longitude());
        address.setDefault(req.isDefault());
        return ResponseEntity.ok(AddressResponse.from(addressRepository.save(address)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        UserAddress address = addressRepository.findById(id).orElse(null);
        if (address == null || !address.getUser().getId().equals(user.getId()))
            return ResponseEntity.notFound().build();
        addressRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    record AddressRequest(String label, String street, String city, String postalCode,
                          Double latitude, Double longitude, boolean isDefault) {}

    record AddressResponse(UUID id, String label, String street, String city,
                           String postalCode, Double latitude, Double longitude, boolean isDefault) {
        static AddressResponse from(UserAddress a) {
            return new AddressResponse(a.getId(), a.getLabel(), a.getStreet(), a.getCity(),
                    a.getPostalCode(), a.getLatitude(), a.getLongitude(), a.isDefault());
        }
    }
}
