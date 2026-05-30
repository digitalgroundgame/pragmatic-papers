"use client"

import { type Form } from "@/payload-types"
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import { useRouter } from "next/navigation"
import React, { useCallback, useState } from "react"
import { type FieldValues, FormProvider, type SubmitHandler, useForm } from "react-hook-form"

import RichText from "@/components/RichText"
import { Button } from "@/components/ui/button"
import { getClientSideURL } from "@/utilities/getURL"
import { fields } from "./fields"

interface FormBlockClientProps {
  enableIntro?: boolean | null
  form: Form
  introContent?: DefaultTypedEditorState | null
}

export const FormBlockClient: React.FC<FormBlockClientProps> = ({
  enableIntro,
  form,
  introContent,
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

  const { id, confirmationType, confirmationMessage, redirect, submitButtonLabel } = form

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
      {enableIntro && introContent && !hasSubmitted && (
        <RichText
          className="mb-8 lg:mb-12"
          data={introContent as unknown as DefaultTypedEditorState}
          enableGutter={false}
        />
      )}
      <div className="rounded-sm border p-4 lg:p-6">
        <FormProvider {...formMethods}>
          {!isLoading && hasSubmitted && confirmationType === "message" && confirmationMessage && (
            <RichText data={confirmationMessage} />
          )}
          {isLoading && !hasSubmitted && <p>Loading, please wait...</p>}
          {error && <div>{`${error.status || "500"}: ${error.message || ""}`}</div>}
          {!hasSubmitted && (
            <form id={id?.toString()} onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4 last:mb-0">
                {typeof form === "object" &&
                  form.fields &&
                  form.fields?.map((field, index) => {
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
