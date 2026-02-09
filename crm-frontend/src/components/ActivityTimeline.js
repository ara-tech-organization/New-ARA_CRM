import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
} from '@mui/material';
import {
  PersonAdd,
  TrendingUp,
  Email,
  Phone,
  CheckCircle,
} from '@mui/icons-material';

const activities = [
  {
    id: 1,
    type: 'lead',
    title: 'New lead added',
    description: 'Alice Williams from Startup XYZ',
    time: '2 hours ago',
    icon: <TrendingUp />,
    color: '#667eea',
    bgColor: '#667eea15',
  },
  {
    id: 2,
    type: 'client',
    title: 'Client onboarded',
    description: 'Jane Smith - Design Studio',
    time: '5 hours ago',
    icon: <PersonAdd />,
    color: '#4caf50',
    bgColor: '#4caf5015',
  },
  {
    id: 3,
    type: 'email',
    title: 'Email sent',
    description: 'Follow-up email to Charlie Brown',
    time: '1 day ago',
    icon: <Email />,
    color: '#2196f3',
    bgColor: '#2196f315',
  },
  {
    id: 4,
    type: 'call',
    title: 'Call completed',
    description: 'Sales call with Diana Prince',
    time: '2 days ago',
    icon: <Phone />,
    color: '#ff9800',
    bgColor: '#ff980015',
  },
  {
    id: 5,
    type: 'deal',
    title: 'Deal closed',
    description: '$25,000 contract with Global Solutions',
    time: '3 days ago',
    icon: <CheckCircle />,
    color: '#4caf50',
    bgColor: '#4caf5015',
  },
];

const ActivityTimeline = () => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Recent Activity
        </Typography>
        <Box sx={{ position: 'relative' }}>
          {/* Vertical Line */}
          <Box
            sx={{
              position: 'absolute',
              left: 20,
              top: 8,
              bottom: 8,
              width: 2,
              bgcolor: 'divider',
            }}
          />

          {/* Activity Items */}
          {activities.map((activity, index) => (
            <Box
              key={activity.id}
              sx={{
                position: 'relative',
                pl: 6,
                pb: index < activities.length - 1 ? 3 : 0,
                '&:hover': {
                  '& .activity-card': {
                    transform: 'translateX(4px)',
                    boxShadow: 2,
                  }
                }
              }}
            >
              {/* Icon Circle */}
              <Avatar
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: 0,
                  width: 26,
                  height: 26,
                  bgcolor: activity.color,
                  boxShadow: `0 0 0 4px ${activity.bgColor}`,
                }}
              >
                {React.cloneElement(activity.icon, { sx: { fontSize: 14 } })}
              </Avatar>

              {/* Content Card */}
              <Box
                className="activity-card"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.3s ease',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {activity.title}
                  </Typography>
                  <Chip
                    label={activity.time}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      bgcolor: activity.bgColor,
                      color: activity.color,
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {activity.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ActivityTimeline;
