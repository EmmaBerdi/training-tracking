package com.training.tracking.service;

import com.training.tracking.domain.ExerciseImage;
import com.training.tracking.repository.ExerciseImageRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Setup photos for exercises. The client downscales and re-encodes before uploading, so what
 * arrives here is already a small JPEG; the limits below are the backstop for anything else.
 */
@Service
public class ExerciseImageService {

    /** A 12 MP phone photo passes; a header claiming far more is a decompression bomb, not a photo. */
    private static final long MAX_PIXELS = 40_000_000L;

    /** The formats ImageIO can verify, mapped from what its readers report to what we store. */
    private static final Map<String, String> CONTENT_TYPE_BY_FORMAT =
            Map.of("jpeg", "image/jpeg", "jpg", "image/jpeg", "png", "image/png");

    /** How long a freshly uploaded image is spared by the orphan sweep. */
    private static final Duration UPLOAD_GRACE = Duration.ofHours(1);

    private final ExerciseImageRepository repository;

    public ExerciseImageService(ExerciseImageRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ExerciseImage store(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw badRequest("no image uploaded");
        }
        if (file.getSize() > ExerciseImage.MAX_BYTES) {
            throw badRequest("image must be at most " + (ExerciseImage.MAX_BYTES / 1024) + " KB");
        }

        byte[] bytes = read(file);
        Format format = probe(bytes);

        ExerciseImage image = new ExerciseImage();
        image.setId(UUID.randomUUID());
        image.setUserId(userId);
        image.setContentType(format.contentType());
        image.setByteSize(bytes.length);
        image.setWidth(format.width());
        image.setHeight(format.height());
        image.setData(bytes);
        image.setCreatedAt(Instant.now());
        return repository.save(image);
    }

    @Transactional(readOnly = true)
    public ExerciseImage load(Long userId, UUID id) {
        // 404 rather than 403 for someone else's image: whether that id exists is not their business.
        return repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no such image"));
    }

    /**
     * Rejects ids this user doesn't own. Without it a plan could name any id and read a stranger's
     * picture back through its own {@code GET /api/state}.
     */
    public void requireOwnership(Long userId, Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return;
        }
        Set<UUID> owned = new HashSet<>(repository.findOwnedIds(userId, ids));
        for (UUID id : ids) {
            if (!owned.contains(id)) {
                throw badRequest("unknown image " + id);
            }
        }
    }

    /** Called after a plan save has re-inserted the exercises that hold the surviving references. */
    public void collectOrphans(Long userId) {
        repository.deleteUnreferenced(userId, Instant.now().minus(UPLOAD_GRACE));
    }

    public static UUID parseId(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            throw badRequest("malformed image id " + raw);
        }
    }

    private static byte[] read(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw badRequest("could not read the uploaded image");
        }
    }

    /**
     * Reads the header only. That is enough to prove the bytes really are an image of a format we
     * accept — a renamed PDF has no reader — and yields the dimensions without decoding megapixels
     * into memory. The stored content type comes from what the reader recognised rather than from
     * the client's header, so it always describes the bytes.
     */
    private static Format probe(byte[] bytes) {
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) {
                throw badRequest("unsupported image format — use JPEG or PNG");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream);
                String contentType = CONTENT_TYPE_BY_FORMAT
                        .get(reader.getFormatName().toLowerCase(Locale.ROOT));
                if (contentType == null) {
                    throw badRequest("unsupported image format — use JPEG or PNG");
                }
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if ((long) width * height > MAX_PIXELS) {
                    throw badRequest("image is too large: " + width + "x" + height);
                }
                return new Format(contentType, width, height);
            } finally {
                reader.dispose();
            }
        } catch (IOException ex) {
            throw badRequest("could not read the uploaded image");
        }
    }

    private record Format(String contentType, int width, int height) {
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
