#!/bin/bash

# Complete Setup Script for Secure File Sharing Application
# This script will set up the entire application from scratch

set -e  # Exit on any error

echo "🚀 Starting Complete Setup for Secure File Sharing Application"
echo "============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js is installed: $NODE_VERSION"
        
        # Check if version is sufficient (16.x or higher)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -lt 16 ]; then
            print_warning "Node.js version is $NODE_VERSION. Version 16 or higher is recommended."
        fi
    else
        print_error "Node.js is not installed. Please install Node.js 16 or higher."
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
}

# Check if MongoDB is running
check_mongodb() {
    print_info "Checking MongoDB connection..."
    
    if command -v mongosh &> /dev/null; then
        if mongosh --eval "db.adminCommand('ping')" --quiet localhost:27017/test &> /dev/null; then
            print_status "MongoDB is running and accessible"
        else
            print_warning "MongoDB is not running. Please start MongoDB before continuing."
            print_info "To start MongoDB:"
            echo "  - On Ubuntu/Debian: sudo systemctl start mongod"
            echo "  - On macOS with Homebrew: brew services start mongodb/brew/mongodb-community"
            echo "  - On Windows: net start MongoDB"
        fi
    else
        print_warning "MongoDB Shell (mongosh) not found. Installing it is recommended for database management."
    fi
}

# Setup backend
setup_backend() {
    print_info "Setting up backend..."
    
    cd backend
    
    # Install dependencies
    print_info "Installing backend dependencies..."
    npm install
    print_status "Backend dependencies installed"
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_info "Creating backend .env file..."
        cp .env.example .env
        print_status "Backend .env file created from template"
        print_warning "Please review and update backend/.env with your specific configuration"
    else
        print_status "Backend .env file already exists"
    fi
    
    # Create CA directory if it doesn't exist
    if [ ! -d ca ]; then
        mkdir -p ca
        print_status "Created CA directory"
    fi
    
    cd ..
}

# Setup frontend
setup_frontend() {
    print_info "Setting up frontend..."
    
    cd frontend
    
    # Install dependencies
    print_info "Installing frontend dependencies..."
    npm install
    print_status "Frontend dependencies installed"
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_info "Creating frontend .env file..."
        cp .env.example .env
        print_status "Frontend .env file created from template"
        print_warning "Please review and update frontend/.env with your specific configuration"
    else
        print_status "Frontend .env file already exists"
    fi
    
    cd ..
}

# Test backend setup
test_backend() {
    print_info "Testing backend setup..."
    
    cd backend
    
    # Start backend in background for testing
    print_info "Starting backend for testing..."
    npm start &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 5
    
    # Test if backend is responding
    if curl -s http://localhost:5000/health > /dev/null; then
        print_status "Backend is responding correctly"
        
        # Test authentication endpoints
        if curl -s http://localhost:5000/api/test > /dev/null; then
            print_status "Backend API endpoints are accessible"
        else
            print_warning "Backend API endpoints might not be fully accessible"
        fi
    else
        print_error "Backend is not responding. Check the logs for errors."
    fi
    
    # Stop the test backend
    kill $BACKEND_PID 2>/dev/null || true
    sleep 2
    
    cd ..
}

# Create startup scripts
create_startup_scripts() {
    print_info "Creating startup scripts..."
    
    # Create development startup script
    cat > start-dev.sh << 'EOF'
#!/bin/bash

# Development Startup Script
echo "🚀 Starting Secure File Sharing Application (Development Mode)"

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down..."
    jobs -p | xargs -r kill
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "📡 Starting backend server..."
cd backend && npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "🌐 Starting frontend development server..."
cd ../frontend && npm start &
FRONTEND_PID=$!

echo "✅ Application started successfully!"
echo "🌐 Frontend: http://localhost:3000"
echo "📡 Backend:  http://localhost:5000"
echo "📊 Health:   http://localhost:5000/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait
EOF

    chmod +x start-dev.sh
    print_status "Created start-dev.sh"
    
    # Create production startup script
    cat > start-prod.sh << 'EOF'
#!/bin/bash

# Production Startup Script
echo "🚀 Starting Secure File Sharing Application (Production Mode)"

# Set production environment
export NODE_ENV=production

# Build frontend
echo "🏗️ Building frontend for production..."
cd frontend && npm run build
cd ..

# Start backend
echo "📡 Starting backend server..."
cd backend && npm start &

echo "✅ Application started in production mode!"
echo "📡 Backend: http://localhost:5000"
echo "📊 Health:  http://localhost:5000/health"
echo ""
echo "Frontend is built and ready to be served by a web server"
EOF

    chmod +x start-prod.sh
    print_status "Created start-prod.sh"
}

# Show final instructions
show_instructions() {
    echo ""
    echo "🎉 Setup Complete!"
    echo "=================="
    echo ""
    print_status "The Secure File Sharing Application has been set up successfully."
    echo ""
    echo "📝 Next Steps:"
    echo "1. Review and update configuration files:"
    echo "   - backend/.env"
    echo "   - frontend/.env"
    echo ""
    echo "2. Start the application:"
    echo "   For Development: ./start-dev.sh"
    echo "   For Production:  ./start-prod.sh"
    echo ""
    echo "3. Access the application:"
    echo "   🌐 Frontend: http://localhost:3000"
    echo "   📡 Backend:  http://localhost:5000"
    echo "   📊 Health:   http://localhost:5000/health"
    echo ""
    echo "4. Register a new user and download your private key"
    echo "5. Use the private key to log in"
    echo ""
    print_warning "Important Security Notes:"
    echo "- Keep your private key files safe and secure"
    echo "- Update JWT_SECRET in backend/.env for production"
    echo "- Consider using HTTPS in production"
    echo "- Regularly backup your MongoDB database"
    echo ""
    print_info "For troubleshooting, check:"
    echo "- Application logs in the terminal"
    echo "- Browser developer console"
    echo "- MongoDB connection status"
    echo ""
    echo "🆘 If you encounter issues:"
    echo "1. Check that MongoDB is running"
    echo "2. Verify all dependencies are installed"
    echo "3. Check firewall settings"
    echo "4. Review configuration files"
}

# Main execution
main() {
    echo "🔧 System Checks"
    echo "=================="
    check_nodejs
    check_mongodb
    
    echo ""
    echo "📦 Installing Dependencies"
    echo "=========================="
    setup_backend
    setup_frontend
    
    echo ""
    echo "🧪 Testing Setup"
    echo "================"
    test_backend
    
    echo ""
    echo "📜 Creating Scripts"
    echo "=================="
    create_startup_scripts
    
    show_instructions
}

# Run main function
main