"use client"

import { type Form } from "@/payload-types"
import { useRouter } from "next/navigation"
import React, { useCallback, useState } from "react"
import { type FieldValues, FormProvider, type SubmitHandler, useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { getClientSideURL } from "@/utilities/getURL"
import { fields } from "./fields"

interface FormBlockClientProps {
  form: Form
  /** Server-rendered intro rich text, or null when the block has none. */
  intro?: React.ReactNode
  /** Server-rendered confirmation rich text, shown after a successful submit. */
  confirmation?: React.ReactNode
  /** Server-rendered `message` fields, keyed by their position in the form. */
  messages?: Record<number, React.ReactNode>
}

export const FormBlockClient: React.FC<FormBlockClientProps> = ({
  form,
  intro,
  confirmation,
  messages,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState<boolean>()
  const [error, setError] = useState<{ message: string; status?: string } | undefined>()
  const router = useRouter()
  const formMethods = useForm()

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = formMethods

  const { id, confirmationType, redirect, submitButtonLabel } = form

  const onSubmit: SubmitHandler<FieldValues> = useCallback(
    (data) => {
      let loadingTimerID: ReturnType<typeof setTimeout>
      const submitForm = async () => {
        setError(undefined)

        const submissionData = Object.entries(data).map(([name, value]) => ({
          field: name,
          value,
        }))

        // delay loading indicator by 1s
        loadingTimerID = setTimeout(() => {
          setIsLoading(true)
        }, 1000)

        try {
          const req = await fetch(`${getClientSideURL()}/api/form-submissions`, {
            body: JSON.stringify({
              form: id,
              submissionData,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          })

          const res = await req.json()

          clearTimeout(loadingTimerID)

          if (req.status >= 400) {
            setIsLoading(false)

            setError({
              message: res.errors?.[0]?.message || "Internal Server Error",
              status: res.status,
            })

            return
          }

          setIsLoading(false)
          setHasSubmitted(true)

          if (confirmationType === "redirect" && redirect) {
            const { url } = redirect

            const redirectUrl = url

            if (redirectUrl) router.push(redirectUrl)
          }
        } catch (err) {
          console.warn(err)
          setIsLoading(false)
          setError({
            message: "Something went wrong.",
          })
        }
      }

      void submitForm()
    },
    [router, id, confirmationType, redirect],
  )

  return (
    <div className="container lg:max-w-3xl">
      {intro && !hasSubmitted && intro}
      <div className="rounded-sm border p-4 lg:p-6">
        <FormProvider {...formMethods}>
          {!isLoading && hasSubmitted && confirmation}
          {isLoading && !hasSubmitted && <p>Loading, please wait...</p>}
          {error && <div>{`${error.status || "500"}: ${error.message || ""}`}</div>}
          {!hasSubmitted && (
            <form id={id?.toString()} onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4 last:mb-0">
                {typeof form === "object" &&
                  form.fields &&
                  form.fields?.map((field, index) => {
                    // Message fields are static copy, rendered on the server.
                    if (field.blockType === "message") {
                      const message = messages?.[index]
                      return message ? (
                        <div className="mb-6 last:mb-0" key={index}>
                          {message}
                        </div>
                      ) : null
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const Field: React.FC<any> = fields?.[field.blockType as keyof typeof fields]
                    if (Field) {
                      return (
                        <div className="mb-6 last:mb-0" key={index}>
                          <Field
                            form={form}
                            {...field}
                            {...formMethods}
                            control={control}
                            errors={errors}
                            register={register}
                          />
                        </div>
                      )
                    }
                    return null
                  })}
              </div>

              <Button form={id?.toString()} type="submit" variant="default">
                {submitButtonLabel}
              </Button>
            </form>
          )}
        </FormProvider>
      </div>
    </div>
  )
}
