"use client"

import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TAB_VALUES = ["overview", "activity", "properties", "messages", "tasks"] as const
type TabValue = (typeof TAB_VALUES)[number]

function resolveTab(tab?: string): TabValue {
  return TAB_VALUES.includes(tab as TabValue) ? (tab as TabValue) : "overview"
}

export function ContactDetailTabs({
  defaultTab,
  overview,
  activity,
  properties,
  messages,
  tasks,
}: {
  defaultTab?: string
  overview: ReactNode
  activity: ReactNode
  properties: ReactNode
  messages: ReactNode
  tasks: ReactNode
}) {
  return (
    <Tabs defaultValue={resolveTab(defaultTab)} className="w-full">
      <TabsList variant="line" className="mb-4 w-full justify-start overflow-x-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="properties">Properties</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-4">
        {overview}
      </TabsContent>
      <TabsContent value="activity" className="space-y-4">
        {activity}
      </TabsContent>
      <TabsContent value="properties" className="space-y-4">
        {properties}
      </TabsContent>
      <TabsContent value="messages" className="space-y-4">
        {messages}
      </TabsContent>
      <TabsContent value="tasks" className="space-y-4">
        {tasks}
      </TabsContent>
    </Tabs>
  )
}
