# CRM Pro - Frontend Application

A modern, professional Customer Relationship Management (CRM) system built with React, Material-UI, and Redux.

## Features

- **Authentication System**: Secure login with form validation
- **Dashboard**: Comprehensive overview with statistics, charts, and today's leads
- **Client Management**: Add, view, and manage client information
- **Lead Management**: Track leads with status, source, and value
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Modern UI**: Professional design using Material-UI components
- **State Management**: Redux Toolkit for efficient state management
- **Data Visualization**: Charts and graphs using Recharts

## Tech Stack

- **React 19.2.3** - Frontend framework
- **Material-UI (MUI) 5.15** - UI component library
- **Redux Toolkit 2.0** - State management
- **React Router 6.21** - Routing
- **Formik & Yup** - Form handling and validation
- **Recharts 2.12** - Charts and data visualization
- **Axios 1.6** - HTTP client

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000)

## Demo Credentials

Use the following credentials to log in:

- **Email**: admin@crm.com
- **Password**: admin123

## Project Structure

```
frontend/
├── public/                 # Static files
├── src/
│   ├── components/        # Reusable components
│   │   └── Loading.js     # Loading spinner component
│   ├── layouts/           # Layout components
│   │   └── MainLayout.js  # Main app layout with sidebar
│   ├── pages/             # Page components
│   │   ├── Login.js       # Login page
│   │   ├── Dashboard.js   # Dashboard with stats and charts
│   │   ├── Clients.js     # Client management page
│   │   └── Leads.js       # Lead management page
│   ├── store/             # Redux store
│   │   ├── index.js       # Store configuration
│   │   └── slices/        # Redux slices
│   │       ├── authSlice.js    # Authentication state
│   │       ├── clientSlice.js  # Client state
│   │       └── leadSlice.js    # Lead state
│   ├── theme/             # MUI theme configuration
│   │   └── theme.js       # Custom theme settings
│   ├── utils/             # Utility functions
│   │   └── ProtectedRoute.js  # Route protection HOC
│   ├── App.js             # Main app component with routing
│   ├── App.css            # Global styles
│   ├── index.js           # App entry point
│   └── index.css          # Base CSS
├── package.json           # Dependencies
└── README.md             # This file
```

## Available Scripts

### `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000)

### `npm test`
Launches the test runner in interactive watch mode

### `npm run build`
Builds the app for production to the `build` folder

### `npm run eject`
Ejects from Create React App (one-way operation)

## Key Features Explained

### Dashboard
- **Statistics Cards**: Total clients, leads, today's leads, and pipeline value
- **Charts**: Visual representation of leads by source and status
- **Today's Leads Table**: Quick view of new leads
- **Recent Clients**: Overview of latest client additions

### Client Management
- **Add Clients**: Form with validation for adding new clients
- **Client List**: Sortable table with pagination
- **Delete Clients**: Remove clients with confirmation
- **Status Tracking**: Active/Inactive client status

### Lead Management
- **Add/Edit Leads**: Comprehensive form for lead details
- **Lead Tracking**: Track status (New, Contacted, Qualified, Lost)
- **Source Attribution**: Track lead sources (Website, Referral, etc.)
- **Value Estimation**: Assign monetary value to leads
- **Pipeline View**: Visual overview of total pipeline value

### Authentication
- **Secure Login**: Email and password validation
- **Session Persistence**: Login state saved in localStorage
- **Protected Routes**: Automatic redirect to login for unauthenticated users
- **Logout**: Clear session and return to login

## State Management

The application uses Redux Toolkit for state management with three main slices:

1. **Auth Slice** (`authSlice.js`)
   - User authentication state
   - Login/logout actions
   - Token management

2. **Client Slice** (`clientSlice.js`)
   - Client data storage
   - CRUD operations for clients
   - Sample data included

3. **Lead Slice** (`leadSlice.js`)
   - Lead data storage
   - CRUD operations for leads
   - Sample data included

## Customization

### Theme
Edit `src/theme/theme.js` to customize:
- Colors (primary, secondary, etc.)
- Typography
- Shadows
- Component styles

### Sample Data
Sample data is included in the Redux slices for demonstration. To connect to a real backend:
1. Create API service files in `src/services/`
2. Use Redux Toolkit's `createAsyncThunk` for async operations
3. Update slices to handle API responses

## Security Features

- Input validation using Yup schemas
- Protected routes requiring authentication
- XSS protection through React's built-in escaping
- Secure form handling with Formik
- Token-based authentication ready

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Future Enhancements

- Backend API integration
- Advanced filtering and search
- Export to CSV/PDF
- Email notifications
- Calendar integration
- Task management
- Reports and analytics
- User roles and permissions
- Dark mode toggle

## Contributing

This is a demonstration project. For production use:
1. Connect to a real backend API
2. Implement proper authentication (JWT, OAuth, etc.)
3. Add comprehensive testing
4. Set up CI/CD pipeline
5. Add error boundaries
6. Implement logging and monitoring

## License

This project is created for demonstration purposes.

## Support

For questions or issues, please refer to the documentation or create an issue in the repository.
