# Base image with Node and Python
FROM node:18

# Install Python and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install Node.js dependencies
RUN npm ci

# Install Python dependencies (create requirements.txt first!)
RUN pip3 install -r requirements.txt

# Expose the port your Express app runs on (default is 3000)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
