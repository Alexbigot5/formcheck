import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Phone, Mail, Users, CheckSquare, Plus, Clock, AlertTriangle, Filter } from "lucide-react";
import { Task } from "@/pages/CrmHub";

interface TasksTabProps {
  tasks: Task[];
}

const TasksTab: React.FC<TasksTabProps> = ({ tasks }) => {
  const [filter, setFilter] = useState("all");
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    type: "Call" as Task['type'],
    title: "",
    dueDate: "",
    owner: "",
    priority: "Medium" as Task['priority']
  });

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'Call': return <Phone className="h-4 w-4 text-green-600" />;
      case 'Email': return <Mail className="h-4 w-4 text-blue-600" />;
      case 'Meeting': return <Users className="h-4 w-4 text-purple-600" />;
      case 'To-do': return <CheckSquare className="h-4 w-4 text-orange-600" />;
      default: return <CheckSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600 bg-red-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'Completed' ? 'text-green-600 bg-green-100' : 'text-blue-600 bg-blue-100';
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  const isToday = (dueDate: string) => {
    return new Date(dueDate).toDateString() === new Date().toDateString();
  };

  const isUpcoming = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 7;
  };

  const getFilteredTasks = () => {
    switch (filter) {
      case 'today':
        return tasks.filter(task => isToday(task.dueDate) && task.status === 'Open');
      case 'overdue':
        return tasks.filter(task => isOverdue(task.dueDate) && task.status === 'Open');
      case 'upcoming':
        return tasks.filter(task => isUpcoming(task.dueDate) && task.status === 'Open');
      case 'completed':
        return tasks.filter(task => task.status === 'Completed');
      default:
        return tasks;
    }
  };

  const handleAddTask = () => {
    // In a real app, this would add the task to the state/database
    console.log('Adding task:', newTask);
    setShowAddTaskDialog(false);
    setNewTask({
      type: "Call",
      title: "",
      dueDate: "",
      owner: "",
      priority: "Medium"
    });
  };

  const getTaskCounts = () => {
    return {
      today: tasks.filter(task => isToday(task.dueDate) && task.status === 'Open').length,
      overdue: tasks.filter(task => isOverdue(task.dueDate) && task.status === 'Open').length,
      upcoming: tasks.filter(task => isUpcoming(task.dueDate) && task.status === 'Open').length,
      completed: tasks.filter(task => task.status === 'Completed').length
    };
  };

  const filteredTasks = getFilteredTasks();
  const taskCounts = getTaskCounts();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tasks</h2>
          <p className="text-muted-foreground">Manage your sales activities and follow-ups</p>
        </div>
        <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="task-type">Task Type</Label>
                <Select value={newTask.type} onValueChange={(value: Task['type']) => setNewTask({...newTask, type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Call">Call</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="To-do">To-do</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-title">Title</Label>
                <Input
                  id="task-title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <Label htmlFor="task-due">Due Date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="task-owner">Owner</Label>
                <Input
                  id="task-owner"
                  value={newTask.owner}
                  onChange={(e) => setNewTask({...newTask, owner: e.target.value})}
                  placeholder="Assign to..."
                />
              </div>
              <div>
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={newTask.priority} onValueChange={(value: Task['priority']) => setNewTask({...newTask, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddTask} className="flex-1">
                  Create Task
                </Button>
                <Button variant="outline" onClick={() => setShowAddTaskDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Task Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className={`rounded-xl cursor-pointer transition-colors ${filter === 'today' ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
          onClick={() => setFilter('today')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Today</p>
                <p className="text-2xl font-bold">{taskCounts.today}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`rounded-xl cursor-pointer transition-colors ${filter === 'overdue' ? 'ring-2 ring-red-500' : 'hover:bg-gray-50'}`}
          onClick={() => setFilter('overdue')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{taskCounts.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`rounded-xl cursor-pointer transition-colors ${filter === 'upcoming' ? 'ring-2 ring-yellow-500' : 'hover:bg-gray-50'}`}
          onClick={() => setFilter('upcoming')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{taskCounts.upcoming}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`rounded-xl cursor-pointer transition-colors ${filter === 'completed' ? 'ring-2 ring-green-500' : 'hover:bg-gray-50'}`}
          onClick={() => setFilter('completed')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{taskCounts.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={filter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('all')}
          >
            All Tasks
          </Button>
          <Button 
            variant={filter === 'today' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('today')}
          >
            Today ({taskCounts.today})
          </Button>
          <Button 
            variant={filter === 'overdue' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('overdue')}
          >
            Overdue ({taskCounts.overdue})
          </Button>
          <Button 
            variant={filter === 'upcoming' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setFilter('upcoming')}
          >
            Upcoming ({taskCounts.upcoming})
          </Button>
        </div>
      </div>

      {/* Tasks Table */}
      <Card className="rounded-xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="font-semibold">Task</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
                <TableHead className="font-semibold">Owner</TableHead>
                <TableHead className="font-semibold">Priority</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {getTaskIcon(task.type)}
                      <span>{task.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {task.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`${
                        isOverdue(task.dueDate) && task.status === 'Open' ? 'text-red-600 font-medium' :
                        isToday(task.dueDate) ? 'text-blue-600 font-medium' : ''
                      }`}>
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                      {isOverdue(task.dueDate) && task.status === 'Open' && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{task.owner}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                      {task.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tasks found for the selected filter</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TasksTab;
