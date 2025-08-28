import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Link2, Plus, Unlink } from 'lucide-react';
import { uniboxStore } from '@/store/uniboxStore';
import { Conversation } from '@/lib/types';
import { toast } from 'sonner';

interface LinkLeadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
}

const LinkLeadDialog: React.FC<LinkLeadDialogProps> = ({
  isOpen,
  onClose,
  conversation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const leads = uniboxStore.getLeads();

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLinkLead = async (leadId: string, leadName: string) => {
    setIsLoading(true);
    try {
      await uniboxStore.linkLead(conversation.id, leadId, leadName);
      toast.success(`Linked conversation to ${leadName}`);
      onClose();
    } catch (error) {
      toast.error('Failed to link lead');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkLead = async () => {
    setIsLoading(true);
    try {
      await uniboxStore.unlinkLead(conversation.id);
      toast.success('Unlinked lead from conversation');
      onClose();
    } catch (error) {
      toast.error('Failed to unlink lead');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to Lead</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Current link status */}
          {conversation.leadId ? (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-200 text-blue-800">
                      {conversation.leadName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{conversation.leadName}</div>
                    <div className="text-sm text-muted-foreground">Currently linked</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlinkLead}
                  disabled={isLoading}
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  Unlink
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              This conversation is not linked to any lead.
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search leads by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lead list */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div>No leads found</div>
                {searchQuery && (
                  <div className="text-sm mt-1">Try different search terms</div>
                )}
              </div>
            ) : (
              filteredLeads.map(lead => (
                <Button
                  key={lead.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => handleLinkLead(lead.id, lead.name)}
                  disabled={isLoading || conversation.leadId === lead.id}
                >
                  <Avatar className="w-8 h-8 mr-3">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {lead.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left flex-1">
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-sm text-muted-foreground">{lead.email}</div>
                  </div>
                  {conversation.leadId === lead.id && (
                    <Badge variant="secondary" className="ml-2">
                      Linked
                    </Badge>
                  )}
                </Button>
              ))
            )}
          </div>

          {/* Create new lead button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              toast.info('Create new lead functionality would be implemented here');
              onClose();
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create new lead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkLeadDialog;
