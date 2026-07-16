import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as SparkleIcon,
  CheckCircleOutline as StrengthIcon,
  TipsAndUpdates as StrategyIcon,
  WarningAmberOutlined as ImproveIcon,
  ReportGmailerrorredOutlined as UrgentIcon,
  MonitorHeart as KpiIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../api/axios';

// AI-powered campaign analysis panel. The parent supplies:
//   platform     — "google" | "meta"
//   clientName   — string (shown in the request + rendered in the header)
//   dateRange    — { from, to } (YYYY-MM-DD strings)
//   summary      — flat object with metric fields the backend prompt uses
//   campaigns    — optional array of campaign-level rows for the breakdown
//   accentColor  — hex string; matches the tab's platform color
//
// The panel is a self-contained card the parent drops into either
// the Google Ads or Meta Ads tab. Nothing loads until the user
// clicks Generate — the AI call is expensive so we make it explicit.

const BROWN = '#1F3966';
const COPPER = '#1F3966';
const CREAM = '#F1F5F9';
const BORDER = '#E4EAF3';
const CRIT = '#EF4444';
const WARN = '#F59E0B';
const GOOD = '#10B981';

const gradeColor = (g) => {
  const norm = (g || '').toUpperCase().charAt(0);
  if (norm === 'A') return GOOD;
  if (norm === 'B') return '#22C55E';
  if (norm === 'C') return WARN;
  if (norm === 'D') return '#F97316';
  return CRIT;
};

const AiCampaignInsights = ({
  platform,
  clientName,
  dateRange,
  summary,
  campaigns,
  accentColor = COPPER,
}) => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/ai/analyze-campaign', {
        platform,
        clientName,
        dateRange,
        summary,
        campaigns,
      });
      setInsights(res.data?.insights || null);
      setMeta({ model: res.data?.model, generatedAt: res.data?.generatedAt });
    } catch (err) {
      setError(
        err?.response?.data?.message
        || err?.message
        || 'Failed to generate AI insights',
      );
    } finally {
      setLoading(false);
    }
  };

  const platformLabel = platform === 'meta' ? 'Meta Ads' : 'Google Ads';

  return (
    <Card
      variant="outlined"
      sx={{
        my: 2,
        overflow: 'hidden',
        position: 'relative',
        borderColor: `${accentColor}55`,
        background: `linear-gradient(180deg, ${CREAM} 0%, #fff 60%)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 4,
          background: `linear-gradient(180deg, ${accentColor} 0%, ${COPPER} 100%)`,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
          mb: insights || error ? 2 : 1,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.4 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.5,
              bgcolor: accentColor, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 6px 16px ${accentColor}44`,
            }}>
              <SparkleIcon />
            </Box>
            <Box>
              <Typography sx={{
                fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.5px',
                color: accentColor, textTransform: 'uppercase', lineHeight: 1,
                mb: 0.4,
              }}>
                AI Insights · Gemini
              </Typography>
              <Typography sx={{
                fontWeight: 800, fontSize: '1.1rem', color: BROWN, lineHeight: 1.2,
              }}>
                {platformLabel} performance analysis
                {clientName ? ` for ${clientName}` : ''}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: `${BROWN}99`, mt: 0.4 }}>
                AI reads the numbers on this page and returns a summary, strengths, gaps, and strategies to lift lead volume and lower CPL.
              </Typography>
            </Box>
          </Box>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            startIcon={
              loading
                ? <CircularProgress size={16} sx={{ color: '#fff' }} />
                : (insights ? <RefreshIcon /> : <SparkleIcon />)
            }
            sx={{
              bgcolor: accentColor, color: '#fff',
              textTransform: 'none', fontWeight: 800,
              px: 2, py: 1, borderRadius: 1.5,
              minWidth: 160,
              boxShadow: `0 6px 16px ${accentColor}44`,
              '&:hover': { bgcolor: accentColor, filter: 'brightness(1.08)' },
              '&.Mui-disabled': {
                bgcolor: `${accentColor}66`, color: '#ffffffcc',
              },
            }}
          >
            {loading ? 'Analysing…' : insights ? 'Re-generate' : 'Generate Analysis'}
          </Button>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{ mt: 1.5, borderRadius: 1.5, fontSize: '0.85rem' }}
          >
            {error}
          </Alert>
        )}

        {loading && !insights && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.4,
            px: 1.6, py: 1.6, mt: 1,
            borderRadius: 1.5,
            bgcolor: '#fff', border: `1px dashed ${BORDER}`,
          }}>
            <CircularProgress size={18} sx={{ color: accentColor }} />
            <Typography sx={{ fontSize: '0.86rem', color: `${BROWN}AA`, fontWeight: 500 }}>
              Reading campaign data and building recommendations…
            </Typography>
          </Box>
        )}

        {insights && (
          <>
            {/* Summary + grade */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr max-content' },
              gap: 2,
              alignItems: 'stretch',
              mt: 1,
            }}>
              <Box sx={{
                bgcolor: '#fff', border: `1px solid ${BORDER}`,
                borderRadius: 1.5, p: 1.6,
              }}>
                <Typography sx={{
                  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.2px',
                  color: COPPER, textTransform: 'uppercase', mb: 0.6,
                }}>
                  Overall
                </Typography>
                <Typography sx={{ fontSize: '0.92rem', color: BROWN, lineHeight: 1.55 }}>
                  {insights.summary}
                </Typography>
              </Box>
              {insights.grade && (
                <Box sx={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  minWidth: 120,
                  p: 1.6, borderRadius: 1.5,
                  bgcolor: `${gradeColor(insights.grade)}12`,
                  border: `1px solid ${gradeColor(insights.grade)}55`,
                }}>
                  <Typography sx={{
                    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '1.2px',
                    color: gradeColor(insights.grade),
                    textTransform: 'uppercase',
                  }}>
                    Grade
                  </Typography>
                  <Typography sx={{
                    fontWeight: 900, fontSize: '3rem', lineHeight: 1,
                    color: gradeColor(insights.grade), mt: 0.4,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {insights.grade}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Urgent alerts, if any */}
            {insights.urgent?.length > 0 && (
              <InsightsBlock
                title="Urgent"
                subtitle="Address these before anything else"
                icon={<UrgentIcon />}
                tone={CRIT}
                items={insights.urgent}
              />
            )}

            {/* Strengths, improvements, strategies */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2, mt: 2,
            }}>
              <InsightsBlock
                title="What's working"
                subtitle="Keep doing this"
                icon={<StrengthIcon />}
                tone={GOOD}
                items={insights.strengths}
                dense
              />
              <InsightsBlock
                title="What to improve"
                subtitle="Focus areas"
                icon={<ImproveIcon />}
                tone={WARN}
                items={insights.improvements}
                dense
              />
            </Box>

            <InsightsBlock
              title="Strategies to lift performance"
              subtitle="Concrete actions this week"
              icon={<StrategyIcon />}
              tone={accentColor}
              items={insights.strategies}
              numbered
            />

            {insights.kpis_to_watch?.length > 0 && (
              <InsightsBlock
                title="KPIs to watch"
                subtitle="Metrics to track after making changes"
                icon={<KpiIcon />}
                tone={BROWN}
                items={insights.kpis_to_watch}
                dense
              />
            )}

            {meta && (
              <>
                <Divider sx={{ my: 2, borderColor: `${BROWN}18` }} />
                <Box sx={{
                  display: 'flex', gap: 1, alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                  <Chip
                    size="small"
                    label={`Model: ${meta.model}`}
                    sx={{
                      height: 20, fontSize: '0.66rem', fontWeight: 700,
                      bgcolor: `${COPPER}12`, color: COPPER,
                      border: `1px solid ${COPPER}35`,
                    }}
                  />
                  <Typography sx={{ fontSize: '0.7rem', color: `${BROWN}88` }}>
                    Generated {new Date(meta.generatedAt).toLocaleString('en-GB')}
                  </Typography>
                </Box>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const InsightsBlock = ({ title, subtitle, icon, tone, items, dense, numbered }) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <Box sx={{
      mt: 2, p: 1.6, borderRadius: 1.5,
      bgcolor: '#fff',
      border: `1px solid ${tone}30`,
      borderLeft: `3px solid ${tone}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{
          width: 26, height: 26, borderRadius: '50%',
          bgcolor: `${tone}18`, color: tone,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {React.cloneElement(icon, { sx: { fontSize: 16 } })}
        </Box>
        <Box>
          <Typography sx={{
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.2px',
            color: tone, textTransform: 'uppercase', lineHeight: 1,
          }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{
              fontSize: '0.7rem', color: `${BROWN}88`, mt: 0.2,
            }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      <Box component={numbered ? 'ol' : 'ul'} sx={{
        m: 0, pl: numbered ? 2.6 : 2.2,
        display: 'flex', flexDirection: 'column',
        gap: dense ? 0.4 : 0.6,
        listStyle: numbered ? 'decimal' : 'none',
        '& li::marker': numbered ? { color: tone, fontWeight: 800 } : undefined,
      }}>
        {items.map((it, i) => (
          <Box
            component="li"
            key={i}
            sx={{
              fontSize: dense ? '0.82rem' : '0.86rem',
              color: BROWN,
              lineHeight: 1.5,
              position: 'relative',
              pl: numbered ? 0 : 1.2,
              '&::before': numbered ? undefined : {
                content: '""',
                position: 'absolute',
                left: 0, top: '0.75em',
                width: 6, height: 1,
                backgroundColor: tone,
              },
            }}
          >
            {it}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default AiCampaignInsights;
