import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Search, Mail, MailOpen, Reply, Filter, Send, User, Clock } from "lucide-react";
import { Message } from "@/pages/CrmHub";

interface CommunicationTabProps {
  messages: Message[];
}

const CommunicationTab: React.FC<CommunicationTabProps> = ({ messages }) => {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [replyText, setReplyText] = useState("");

  const getFilteredMessages = () => {
    let filtered = messages;
    
    // Apply filter
    switch (filter) {
      case 'unread':
        filtered = filtered.filter(message => !message.isRead);
        break;
      case 'replied':
        filtered = filtered.filter(message => message.thread.some(t => t.type === 'sent'));
        break;
      default:
        break;
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(message =>
        message.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        message.snippet.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const getMessageCounts = () => {
    return {
      all: messages.length,
      unread: messages.filter(m => !m.isRead).length,
      replied: messages.filter(m => m.thread.some(t => t.type === 'sent')).length
    };
  };

  const handleSendReply = () => {
    if (replyText.trim() && selectedMessage) {
      // In a real app, this would send the reply
      console.log('Sending reply:', replyText);
      setReplyText("");
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredMessages = getFilteredMessages();
  const messageCounts = getMessageCounts();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Communication</h2>
          <p className="text-muted-foreground">Unified inbox for all customer communications</p>
        </div>
        <Button>
          <Send className="h-4 w-4 mr-2" />
          Compose
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={`rounded-xl cursor-pointer transition-colors ${filter === 'all' ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
          onClick={() => setFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-bold">{messageCounts.all}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`rounded-xl cursor-pointer transition-colors ${filter === 'unread' ? 'ring-2 ring-orange-500' : 'hover:bg-gray-50'}`}
          onClick={() => setFilter('unread')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <MailOpen className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold">{messageCounts.unread}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`rounded-xl cursor-pointer transition-colors ${filter === 'replied' ? 'ring-2 ring-green-500' : 'hover:bg-gray-50'}`}
          onClick={() => setFilter('replied')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Reply className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Replied</p>
                <p className="text-2xl font-bold">{messageCounts.replied}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button 
              variant={filter === 'unread' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread
            </Button>
            <Button 
              variant={filter === 'replied' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFilter('replied')}
            >
              Replied
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Table */}
      <Card className="rounded-xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="font-semibold">From</TableHead>
                <TableHead className="font-semibold">Subject</TableHead>
                <TableHead className="font-semibold">Preview</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.map((message) => (
                <TableRow 
                  key={message.id} 
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${!message.isRead ? 'bg-blue-50/30' : ''}`}
                  onClick={() => setSelectedMessage(message)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      <span className={!message.isRead ? 'font-semibold' : ''}>{message.from}</span>
                    </div>
                  </TableCell>
                  <TableCell className={!message.isRead ? 'font-semibold' : ''}>
                    {message.subject}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {message.snippet}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(message.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!message.isRead && (
                        <Badge variant="default" className="text-xs">
                          New
                        </Badge>
                      )}
                      {message.thread.some(t => t.type === 'sent') && (
                        <Badge variant="outline" className="text-xs">
                          <Reply className="h-3 w-3 mr-1" />
                          Replied
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredMessages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No messages found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Thread Drawer */}
      <Sheet open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <SheetContent className="w-[700px] sm:max-w-[700px]">
          {selectedMessage && (
            <>
              <SheetHeader className="pb-6">
                <SheetTitle>{selectedMessage.subject}</SheetTitle>
                <p className="text-muted-foreground">Conversation with {selectedMessage.from}</p>
              </SheetHeader>

              <div className="space-y-6">
                {/* Message Thread */}
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">Conversation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                    {selectedMessage.thread.map((threadMessage) => (
                      <div
                        key={threadMessage.id}
                        className={`p-4 rounded-lg ${
                          threadMessage.type === 'sent'
                            ? 'bg-blue-100 ml-8'
                            : 'bg-gray-100 mr-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {threadMessage.type === 'sent' ? 'You' : threadMessage.from}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTime(threadMessage.timestamp)}
                          </div>
                        </div>
                        <p className="text-sm">{threadMessage.content}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Reply Section */}
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">Reply</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSendReply} disabled={!replyText.trim()}>
                        <Send className="h-4 w-4 mr-2" />
                        Send Reply
                      </Button>
                      <Button variant="outline">
                        Save Draft
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* @mention Notes */}
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">Internal Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Add internal notes (use @mention to tag team members)..."
                      rows={3}
                      className="resize-none"
                    />
                    <Button className="mt-2" variant="outline" size="sm">
                      Add Note
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CommunicationTab;
