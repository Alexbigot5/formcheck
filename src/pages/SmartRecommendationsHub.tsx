import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";
import { 
  Mail, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  TestTube, 
  Target, 
  FileText, 
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Calendar,
  Trophy,
  Lightbulb,
  Play,
  ExternalLink,
  DollarSign,
  Route,
  BookOpen,
  Zap,
  TrendingDown,
  Eye,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Activity,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Settings2,
  Brain,
  Mic,
  Shield,
  UserCheck,
  AlertCircle,
  Plus,
  MoreHorizontal,
  Search
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";

// Mock data structure
const mockData = {
  insights: {
    weeklySummary: "Webinar leads are driving 65% of revenue this week. LinkedIn DMs show a 40% drop-off after initial open. Recommendation: Schedule 2 additional webinars next month to capture ~18 new opportunities."
  },
  kpis: [
    {
      title: "Conversion Rate",
      value: "24.3%",
      change: "+3.2%",
      trend: "up",
      icon: Target,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Best Channel",
      value: "Webinars",
      change: "65% of revenue",
      trend: "up",
      icon: Trophy,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Avg Response Time",
      value: "14.2 min",
      change: "-2.3 min",
      trend: "up",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Top Template",
      value: "Q4 Goals Email",
      change: "42% open rate",
      trend: "up",
      icon: Mail,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ],
  recentChanges: [
    { change: "LinkedIn conversion rate increased by 15%", timeAgo: "2 days ago", type: "positive" },
    { change: "Webinar attendance dropped 8% from last week", timeAgo: "3 days ago", type: "negative" },
    { change: "New email template performing 22% above average", timeAgo: "4 days ago", type: "positive" },
    { change: "Demo-to-close rate improved to 34%", timeAgo: "5 days ago", type: "positive" },
    { change: "Cold outreach response rate declined 5%", timeAgo: "6 days ago", type: "negative" }
  ],
  competitive: {
    items: [
      { competitor: "HubSpot", mentions: 23, sampleText: "They're considering HubSpot but concerned about pricing...", channel: "Email", date: "2024-01-15" },
      { competitor: "Salesforce", mentions: 18, sampleText: "Currently using Salesforce but looking for alternatives...", channel: "Call", date: "2024-01-14" },
      { competitor: "Pipedrive", mentions: 12, sampleText: "Pipedrive seems simpler but lacks advanced features...", channel: "LinkedIn", date: "2024-01-13" }
    ]
  },
  persona: {
    stats: [
      { role: "CFO", openRate: 28.5, replyRate: 12.3, preferredContent: "ROI-focused case studies" },
      { role: "CTO", openRate: 35.2, replyRate: 18.7, preferredContent: "Technical implementation guides" },
      { role: "VP Sales", openRate: 42.1, replyRate: 24.8, preferredContent: "Sales process optimization" },
      { role: "Marketing Manager", openRate: 38.9, replyRate: 21.4, preferredContent: "Lead generation strategies" }
    ],
    insights: "CFOs prefer ROI-driven emails with clear financial impact. CTOs engage more with technical content and implementation details. VP Sales responds best to process optimization and team productivity content."
  }
};

// Smart recommendations data
const smartRecommendations = [
  {
    id: "linkedin-increase",
    title: "Increase LinkedIn outreach by 25%",
    rationale: "LinkedIn leads convert 3x better than other channels",
    impact: "High",
    effort: "Low"
  },
  {
    id: "webinar-schedule",
    title: "Schedule 2 webinars next month",
    rationale: "Webinars drive 65% of current revenue",
    impact: "High",
    effort: "Medium"
  },
  {
    id: "email-timing",
    title: "Shift email sends to Tuesday 10 AM",
    rationale: "34% higher response rates at this time",
    impact: "Medium",
    effort: "Low"
  },
  {
    id: "ai-followups",
    title: "Enable AI follow-ups for cold leads",
    rationale: "18% improvement in engagement rates",
    impact: "Medium",
    effort: "Low"
  },
  {
    id: "template-update",
    title: "Update underperforming templates",
    rationale: "3 templates below 15% open rate",
    impact: "Medium",
    effort: "Medium"
  }
];

// Automated playbooks data
const automatedPlaybooks = [
  {
    id: "top-performers",
    title: "Top Performers' Playbook",
    description: "Sequences and scoring rules from your best team members",
    outcomes: ["31% higher conversion", "5min avg response time", "92% SLA compliance"],
    steps: 8,
    duration: "14 days",
    icon: Trophy
  },
  {
    id: "webinar-followup",
    title: "Webinar Follow-up Playbook",
    description: "Automated post-event nurture sequences",
    outcomes: ["65% attendance to demo", "40% demo to close", "18 day avg cycle"],
    steps: 12,
    duration: "21 days",
    icon: Play
  },
  {
    id: "cold-nurture",
    title: "Cold-to-Warm Nurture Playbook",
    description: "Long-term engagement for cold prospects",
    outcomes: ["15% late conversion", "3x brand recall", "45% referral rate"],
    steps: 15,
    duration: "90 days",
    icon: Mail
  }
];

// A/B testing data
const abTestResults = {
  activeTests: 3,
  currentWinner: {
    test: "Email Subject Line Test",
    winner: "Version B: 'Quick question about [Company]'",
    improvement: "15%",
    confidence: "95%"
  }
};

// Intelligence Hub data
const journeyData = [
  { source: "LinkedIn", leads: 450, converted: 128, conversionRate: 28.4, medianTime: 12 },
  { source: "Webinar", leads: 320, converted: 208, conversionRate: 65.0, medianTime: 8 },
  { source: "Email", leads: 280, converted: 68, conversionRate: 24.3, medianTime: 18 },
  { source: "Referral", leads: 180, converted: 72, conversionRate: 40.0, medianTime: 6 },
  { source: "Content", leads: 220, converted: 44, conversionRate: 20.0, medianTime: 22 }
];

const revenueData = [
  { source: "Webinars", leads: 320, pipeline: 640000, closed: 416000, roi: 3.2, cac: 125 },
  { source: "LinkedIn", leads: 450, pipeline: 450000, closed: 256000, roi: 2.1, cac: 89 },
  { source: "Email", leads: 280, pipeline: 280000, closed: 136000, roi: 1.8, cac: 45 },
  { source: "Referrals", leads: 180, pipeline: 360000, closed: 194000, roi: 4.1, cac: 25 },
  { source: "Content", leads: 220, pipeline: 220000, closed: 98000, roi: 1.5, cac: 67 }
];

const funnelData = [
  { stage: "Leads", value: 1000, dropRate: 0, reasons: [] },
  { stage: "Qualified", value: 750, dropRate: 25, reasons: ["Poor fit", "No budget", "Timing"] },
  { stage: "Demo", value: 450, dropRate: 40, reasons: ["No show", "Not decision maker", "Lost interest"] },
  { stage: "Proposal", value: 280, dropRate: 38, reasons: ["Price objection", "Feature gaps", "Competitor chosen"] },
  { stage: "Closed", value: 120, dropRate: 57, reasons: ["Budget cuts", "Internal changes", "Delayed decision"] }
];

const predictiveScenarios = [
  {
    id: "linkedin-shift",
    title: "Increase LinkedIn Investment",
    description: "Shift 30% of ad budget to LinkedIn",
    prediction: "+42% qualified leads",
    confidence: "87%",
    investment: "$3,200/month"
  },
  {
    id: "webinar-double",
    title: "Double Webinar Frequency",
    description: "Run 2 webinars per month",
    prediction: "+65% pipeline value",
    confidence: "92%",
    investment: "$1,800/month"
  },
  {
    id: "ai-automation",
    title: "Full AI Automation",
    description: "Automate all follow-up sequences",
    prediction: "+28% response rates",
    confidence: "78%",
    investment: "$800/month"
  }
];

const forecastData = [
  { month: "Jan", actual: 1200, predicted: 1250, confidence: [1150, 1350] },
  { month: "Feb", actual: 1350, predicted: 1400, confidence: [1300, 1500] },
  { month: "Mar", actual: 1180, predicted: 1320, confidence: [1220, 1420] },
  { month: "Apr", actual: null, predicted: 1450, confidence: [1350, 1550] },
  { month: "May", actual: null, predicted: 1580, confidence: [1480, 1680] },
  { month: "Jun", actual: null, predicted: 1720, confidence: [1620, 1820] }
];

const conversationData = [
  { id: 1, type: "call", contact: "John Smith", sentiment: "positive", topics: ["pricing", "features"], objections: [], winIndicators: ["budget confirmed", "timeline set"] },
  { id: 2, type: "email", contact: "Sarah Johnson", sentiment: "neutral", topics: ["integration", "security"], objections: ["complex setup"], winIndicators: [] },
  { id: 3, type: "call", contact: "Mike Chen", sentiment: "negative", topics: ["competitors", "pricing"], objections: ["too expensive", "missing features"], winIndicators: [] }
];

const SmartRecommendationsHub = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [conversationExpanded, setConversationExpanded] = useState(false);
  const [competitiveExpanded, setCompetitiveExpanded] = useState(false);
  const [personaExpanded, setPersonaExpanded] = useState(false);

  useEffect(() => {
    // SEO
    document.title = "Recommendations Hub | SmartForms AI";

    const existingMeta = document.querySelector('meta[name="description"]');
    const metaDesc = existingMeta || document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    metaDesc.setAttribute("content", "Smart recommendations, automated playbooks, and intelligence hub for optimizing lead generation performance.");
    if (!existingMeta) document.head.appendChild(metaDesc);

    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      linkCanonical = document.createElement("link");
      linkCanonical.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute("href", `${window.location.origin}/recommendations`);

    // Auth guard
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [navigate, isAuthenticated]);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'High': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getChangeTypeColor = (type: string) => {
    return type === 'positive' ? 'text-green-600' : 'text-red-600';
  };

  const getChangeTypeIcon = (type: string) => {
    return type === 'positive' ? ArrowUpRight : ArrowDownRight;
  };

  const ConfirmationModal = ({ title, description, onConfirm }: { title: string, description: string, onConfirm: () => void }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Apply</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground">{description}</p>
          <div className="flex gap-2">
            <Button onClick={onConfirm} className="flex-1">Confirm</Button>
            <Button variant="outline" className="flex-1">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const PlaybookPreviewModal = ({ playbook }: { playbook: any }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <playbook.icon className="h-5 w-5" />
            {playbook.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground">{playbook.description}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Steps:</span> {playbook.steps}
            </div>
            <div>
              <span className="font-medium">Duration:</span> {playbook.duration}
            </div>
          </div>
          <div className="space-y-2">
            <span className="font-medium text-sm">Expected Outcomes:</span>
            {playbook.outcomes.map((outcome: string, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">{outcome}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4">
            <Button className="flex-1">Apply Playbook</Button>
            <Button variant="outline" className="flex-1">Customize</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <header>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
              <Lightbulb className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Recommendations Hub</h1>
              <p className="text-muted-foreground">Smart insights, automated playbooks, and intelligence analytics</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Actions & Playbooks
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Intelligence Hub
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-6">
              {/* Weekly Insights Hero Card */}
              <Card className="border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-green-50 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-lg">Weekly Insights</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-800 font-medium leading-relaxed">
                    {mockData.insights.weeklySummary}
                  </p>
                  <div className="flex items-center gap-3 mt-4">
                    <Badge className="bg-orange-100 text-orange-800">High Impact</Badge>
                    <Badge className="bg-green-100 text-green-800">92% Confidence</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* 4 KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {mockData.kpis.map((kpi, index) => {
                  const IconComponent = kpi.icon;
                  const ChangeIcon = getChangeTypeIcon(kpi.trend);
                  return (
                    <Card key={index} className="hover:shadow-md transition-all cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                            <IconComponent className={`h-4 w-4 ${kpi.color}`} />
                          </div>
                          <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold mb-1">{kpi.value}</div>
                        <div className="flex items-center gap-1">
                          <ChangeIcon className={`h-3 w-3 ${getChangeTypeColor(kpi.trend)}`} />
                          <span className={`text-xs font-medium ${getChangeTypeColor(kpi.trend)}`}>
                            {kpi.change}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Recent Changes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Changes (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockData.recentChanges.map((change, index) => {
                      const ChangeIcon = getChangeTypeIcon(change.type);
                      return (
                        <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                          <ChangeIcon className={`h-4 w-4 mt-0.5 ${getChangeTypeColor(change.type)}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{change.change}</p>
                            <p className="text-xs text-muted-foreground">{change.timeAgo}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: ACTIONS & PLAYBOOKS */}
            <TabsContent value="actions" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Smart Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-600" />
                      Smart Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {smartRecommendations.map((rec) => (
                        <div key={rec.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{rec.title}</h4>
                            <Badge className={`text-xs ${getImpactColor(rec.impact)}`}>
                              {rec.impact}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">{rec.rationale}</p>
                          <ConfirmationModal 
                            title={`Apply: ${rec.title}`}
                            description={`This will ${rec.title.toLowerCase()}. Are you sure?`}
                            onConfirm={() => console.log(`Applied: ${rec.title}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Right: Automated Playbooks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-orange-600" />
                      Automated Playbooks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {automatedPlaybooks.map((playbook) => {
                        const IconComponent = playbook.icon;
                        return (
                          <div key={playbook.id} className="p-4 border rounded-lg">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                <IconComponent className="h-4 w-4 text-orange-600" />
                              </div>
                              <h4 className="font-medium text-sm">{playbook.title}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">{playbook.description}</p>
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1">Apply Playbook</Button>
                              <PlaybookPreviewModal playbook={playbook} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* A/B Testing Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-5 w-5 text-blue-600" />
                    A/B Testing Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Active Tests: {abTestResults.activeTests}</p>
                      <div className="p-3 bg-green-50 rounded-lg border">
                        <div className="flex items-center gap-2 mb-1">
                          <Trophy className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">Current Winner</span>
                        </div>
                        <p className="text-sm font-semibold text-green-700">{abTestResults.currentWinner.winner}</p>
                        <p className="text-xs text-muted-foreground">
                          {abTestResults.currentWinner.improvement} improvement • {abTestResults.currentWinner.confidence} confidence
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button className="w-full">Roll Out Winner</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: INTELLIGENCE HUB */}
            <TabsContent value="intelligence" className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-2">Intelligence Hub</h2>
                <p className="text-muted-foreground mb-6">Deeper analytics and predictive insights across channels.</p>

                {/* Section A: Cross-Channel Journey Mapping */}
                <Card className="mb-6" onClick={() => navigate('/intelligence/journeys')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 cursor-pointer">
                      <Route className="h-5 w-5 text-purple-600" />
                      Cross-Channel Journey Mapping
                      <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Interactive flow diagram showing lead paths</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={journeyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="source" />
                          <YAxis />
                          <Tooltip formatter={(value, name) => [
                            name === 'conversionRate' ? `${value}%` : value,
                            name === 'conversionRate' ? 'Conversion Rate' : name === 'medianTime' ? 'Median Time (days)' : 'Count'
                          ]} />
                          <Bar dataKey="leads" fill="#8884d8" name="Total Leads" />
                          <Bar dataKey="converted" fill="#82ca9d" name="Converted" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Section B: Revenue Impact Modeling */}
                <Card className="mb-6" onClick={() => navigate('/intelligence/revenue')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 cursor-pointer">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Revenue Impact Modeling
                      <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                    </CardTitle>
                    <div className="flex gap-4 mt-2">
                      <Badge>Highest ROI: Referrals (4.1x)</Badge>
                      <Badge>Lowest CAC: Referrals ($25)</Badge>
                      <Badge>Payback: 3.2 months</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="source" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`$${(value / 1000).toFixed(0)}k`, '']} />
                          <Bar dataKey="pipeline" fill="#ffc658" name="Pipeline Value" />
                          <Bar dataKey="closed" fill="#82ca9d" name="Closed Revenue" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Section C: Funnel Drop-Off Insights */}
                <Card className="mb-6" onClick={() => navigate('/intelligence/funnel')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 cursor-pointer">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      Funnel Drop-Off Insights
                      <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={funnelData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="stage" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3">Top Drop-off Reasons</h4>
                        <div className="space-y-2">
                          <div className="p-2 bg-red-50 rounded text-sm">
                            <span className="font-medium">Demo to Proposal:</span> Price objections (38%)
                          </div>
                          <div className="p-2 bg-yellow-50 rounded text-sm">
                            <span className="font-medium">Qualified to Demo:</span> No-shows (40%)
                          </div>
                        </div>
                        <Button size="sm" className="mt-3 w-full">Generate Fix-It Plan</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section D: Predictive & Forecasting */}
                <Card className="mb-6" onClick={() => navigate('/intelligence/predictive')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 cursor-pointer">
                      <Lightbulb className="h-5 w-5 text-blue-600" />
                      Predictive & Forecasting
                      <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-3">Predictive Scenarios</h4>
                        <div className="space-y-3">
                          {predictiveScenarios.map((scenario) => (
                            <div key={scenario.id} className="p-3 border rounded-lg">
                              <h5 className="font-medium text-sm">{scenario.title}</h5>
                              <p className="text-xs text-muted-foreground mb-1">{scenario.description}</p>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-green-600">{scenario.prediction}</span>
                                <Button size="sm" variant="outline">Apply as Plan</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3">Lead Forecast</h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={forecastData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip />
                              <Line type="monotone" dataKey="actual" stroke="#8884d8" strokeWidth={2} />
                              <Line type="monotone" dataKey="predicted" stroke="#82ca9d" strokeDasharray="5 5" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Collapsible Sections */}
                
                {/* Section E: Conversation Intelligence */}
                <Collapsible open={conversationExpanded} onOpenChange={setConversationExpanded}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-gray-50">
                        <CardTitle className="flex items-center gap-2">
                          <Mic className="h-5 w-5 text-blue-600" />
                          Conversation Intelligence
                          {conversationExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="space-y-3">
                          {conversationData.map((conv) => (
                            <div key={conv.id} className="p-3 border rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={conv.sentiment === 'positive' ? 'default' : conv.sentiment === 'negative' ? 'destructive' : 'secondary'}>
                                  {conv.sentiment}
                                </Badge>
                                <span className="text-sm font-medium">{conv.contact}</span>
                                <span className="text-xs text-muted-foreground">({conv.type})</span>
                              </div>
                              <div className="flex gap-2 mb-2">
                                {conv.topics.map((topic) => (
                                  <Badge key={topic} variant="outline" className="text-xs">{topic}</Badge>
                                ))}
                              </div>
                              {conv.winIndicators.length > 0 && (
                                <div className="text-xs text-green-600">
                                  Win signals: {conv.winIndicators.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <Button size="sm" className="mt-4">Create Coaching Tip</Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Section F: Competitive Intelligence */}
                <Collapsible open={competitiveExpanded} onOpenChange={setCompetitiveExpanded}>
                  <Card className="mt-4">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-gray-50">
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-red-600" />
                          Competitive Intelligence
                          {competitiveExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-3 mb-4">
                          {mockData.competitive.items.map((item, index) => (
                            <div key={index} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-sm">{item.competitor}</h5>
                                <Badge variant="outline">{item.mentions} mentions</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">"{item.sampleText}"</p>
                              <div className="text-xs text-muted-foreground">
                                {item.channel} • {item.date}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Badge>34% mention competitors</Badge>
                          <Badge>HubSpot most frequent</Badge>
                        </div>
                        <Button size="sm" className="mt-3" onClick={() => navigate('/intelligence/competitive')}>
                          View Mentions
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Section G: Persona Analytics */}
                <Collapsible open={personaExpanded} onOpenChange={setPersonaExpanded}>
                  <Card className="mt-4">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-gray-50">
                        <CardTitle className="flex items-center gap-2">
                          <UserCheck className="h-5 w-5 text-purple-600" />
                          Persona Analytics
                          {personaExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="font-medium mb-3">Engagement by Role</h4>
                            <div className="space-y-2">
                              {mockData.persona.stats.map((stat) => (
                                <div key={stat.role} className="p-2 border rounded">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-sm">{stat.role}</span>
                                    <span className="text-xs text-muted-foreground">{stat.replyRate}% reply</span>
                                  </div>
                                  <Progress value={stat.openRate} className="h-2 mb-1" />
                                  <p className="text-xs text-muted-foreground">{stat.preferredContent}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-3">AI Insights</h4>
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm">{mockData.persona.insights}</p>
                            </div>
                            <Button size="sm" className="mt-3 w-full">Generate Persona Playbook</Button>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

              </div>
            </TabsContent>
          </Tabs>
        </header>
      </div>
    </Layout>
  );
};

export default SmartRecommendationsHub;
