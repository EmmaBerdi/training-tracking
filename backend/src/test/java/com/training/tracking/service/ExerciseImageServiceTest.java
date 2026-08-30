package com.training.tracking.service;

import com.training.tracking.domain.ExerciseImage;
import com.training.tracking.domain.User;
import com.training.tracking.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ExerciseImageServiceTest {

    @Autowired
    private ExerciseImageService exerciseImageService;

    @Autowired
    private UserRepository userRepository;

    private Long userId;
    private Long otherUserId;

    @BeforeEach
    void createUsers() {
        userId = createUser();
        otherUserId = createUser();
    }

    private Long createUser() {
        User user = new User();
        user.setEmail("image-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setCreatedAt(Instant.now());
        userRepository.save(user);
        return user.getId();
    }

    private static byte[] encode(String format, int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    private static MockMultipartFile upload(byte[] bytes, String contentType) {
        return new MockMultipartFile("file", "setup.jpg", contentType, bytes);
    }

    @Test
    void storesAPhotoAndReadsItBackByteForByte() throws IOException {
        byte[] bytes = encode("jpeg", 40, 60);

        ExerciseImage stored = exerciseImageService.store(userId, upload(bytes, "image/jpeg"));
        ExerciseImage loaded = exerciseImageService.load(userId, stored.getId());

        assertThat(loaded.getContentType()).isEqualTo("image/jpeg");
        assertThat(loaded.getWidth()).isEqualTo(40);
        assertThat(loaded.getHeight()).isEqualTo(60);
        assertThat(loaded.getByteSize()).isEqualTo(bytes.length);
        assertThat(loaded.getData()).isEqualTo(bytes);
    }

    /** The header is the client's claim about the bytes; the reader is what they actually are. */
    @Test
    void takesTheContentTypeFromTheBytesRatherThanTheHeader() throws IOException {
        ExerciseImage stored = exerciseImageService.store(
                userId, upload(encode("png", 10, 10), "image/jpeg"));

        assertThat(stored.getContentType()).isEqualTo("image/png");
    }

    @Test
    void rejectsSomethingThatIsNotAnImage() {
        MockMultipartFile notAnImage =
                upload("nur Text, kein Bild".getBytes(StandardCharsets.UTF_8), "image/jpeg");

        assertThatThrownBy(() -> exerciseImageService.store(userId, notAnImage))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("unsupported image format");
    }

    @Test
    void rejectsAnEmptyUpload() {
        MockMultipartFile empty = upload(new byte[0], "image/jpeg");

        assertThatThrownBy(() -> exerciseImageService.store(userId, empty))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("no image uploaded");
    }

    @Test
    void rejectsAnUploadOverTheSizeLimit() {
        MockMultipartFile tooBig = upload(new byte[ExerciseImage.MAX_BYTES + 1], "image/jpeg");

        assertThatThrownBy(() -> exerciseImageService.store(userId, tooBig))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("at most");
    }

    /** Someone else's id must look exactly like an id that was never handed out. */
    @Test
    void doesNotHandOutAnotherUsersPhoto() throws IOException {
        ExerciseImage mine = exerciseImageService.store(userId, upload(encode("jpeg", 10, 10), "image/jpeg"));

        assertThatThrownBy(() -> exerciseImageService.load(otherUserId, mine.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void ownershipPassesForOwnIdsAndFailsForForeignOnes() throws IOException {
        ExerciseImage mine = exerciseImageService.store(userId, upload(encode("jpeg", 10, 10), "image/jpeg"));

        exerciseImageService.requireOwnership(userId, List.of(mine.getId()));

        assertThatThrownBy(() -> exerciseImageService.requireOwnership(otherUserId, List.of(mine.getId())))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("unknown image");
    }

    @Test
    void rejectsAMalformedId() {
        assertThatThrownBy(() -> ExerciseImageService.parseId("not-a-uuid"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("malformed image id");
    }
}
