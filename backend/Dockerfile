# Use official Golang image
FROM golang:1.20

# Set working directory
WORKDIR /app

# Copy everything to container
COPY . .

# Build the Go binary
RUN go build -o main .

# Run the binary
CMD ["./main"]
