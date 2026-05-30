import { type FieldHook } from "payload"

export const getNextVolumeNumber: FieldHook = async ({ req }) => {
  const { payload } = req
  const volumes = await payload.find({
    collection: "volumes",
    limit: 1,
    pagination: false,
    sort: "-volumeNumber",
  })
  const highestVolumeNumber = volumes?.docs?.[0]?.volumeNumber || 0
  return highestVolumeNumber + 1
}
