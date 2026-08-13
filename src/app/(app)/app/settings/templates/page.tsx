import { requireOrgContext } from "@/server/session"
import { listTemplates } from "@/domain/comms/service"
import { PageHeader } from "@/components/crm/shared"
import { createTemplateAction, deleteTemplateAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default async function TemplatesSettingsPage() {
  const ctx = await requireOrgContext()
  const templates = await listTemplates(ctx.organization.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Message templates"
        description="Merge vars: {{firstName}}, {{lastName}}, {{agentName}}"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create template</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTemplateAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="New lead intro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Channel</Label>
              <select
                id="channel"
                name="channel"
                defaultValue="EMAIL"
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="subject">Subject (email)</Label>
              <Input id="subject" name="subject" placeholder="Following up, {{firstName}}" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="body">Body</Label>
              <textarea
                id="body"
                name="body"
                required
                rows={5}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Hi {{firstName}}, this is {{agentName}}…"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet.</p>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t.channel}</Badge>
                    <form action={deleteTemplateAction}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Delete
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
