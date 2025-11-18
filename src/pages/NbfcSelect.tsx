import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NbfcProfile {
  nbfc_id: string;
  name: string;
  interest_rate: number;
  approval_type: string;
  processing_fee: number;
}

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export default function NbfcSelect() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ncfcs, setNbfcs] = useState<NbfcProfile[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NbfcProfile | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const DETAIL_TABS = ['Overview','Financial','Approval & KYC','Company','Loan & Tenure','Documents','Notes'] as const;
  const [detailsTab, setDetailsTab] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) return;
      if (profile.role !== 'merchant') {
        navigate('/dashboard', { replace: true });
        return;
      }
      // Merchant must be approved (activated) by Super Admin before choosing NBFC
      if (profile.is_active === false) {
        setError('Your merchant account is pending approval by the Super Admin. Please wait until your account is activated.');
        setLoading(false);
        return;
      }
      try {
        // If already tied up, or latest request is approved, send to dashboard
        try {
          const { data: tie, error: tieErr } = await supabase
            .from('nbfc_tieups')
            .select('merchant_id')
            .eq('merchant_id', profile.id)
            .maybeSingle();
          if (!cancelled && !tieErr && tie) {
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (_) {}
        try {
          const { data: req } = await supabase
            .from('nbfc_tieup_requests')
            .select('status')
            .eq('merchant_id', profile.id)
            .order('requested_at', { ascending: false })
            .maybeSingle();
          if (!cancelled && req?.status === 'approved') {
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (_) {}

        const { data, error } = await supabase
          .from('nbfc_profiles')
          .select('nbfc_id,name,interest_rate,approval_type,processing_fee')
          .order('name');
        if (error) throw error;
        if (!cancelled) setNbfcs(data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load NBFCs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);

  const requestTieUp = async (nbfc: NbfcProfile) => {
    if (!profile) return;
    setError(null);
    setRequesting(nbfc.nbfc_id);
    try {
      // Create or upsert a pending request if not already pending/approved
      const payload = {
        merchant_id: profile.id,
        nbfc_id: nbfc.nbfc_id,
        admin_id: nbfc.nbfc_id, // NBFC admin user id equals nbfc_id
        status: 'pending' as RequestStatus,
        requested_at: new Date().toISOString(),
        responded_at: null,
        reason: null,
      };

      const { error } = await supabase
        .from('nbfc_tieup_requests')
        .upsert(payload, { onConflict: 'merchant_id,nbfc_id' });
      if (error) throw error;

      // Admin dashboard notification (best-effort)
      try {
        await supabase.from('admin_notifications').insert({
          admin_id: nbfc.nbfc_id,
          type: 'merchant_request',
          title: 'Merchant tie-up request',
          message: `${profile.username || profile.id} requested to connect with ${nbfc.name}`,
          payload: { merchant_id: profile.id, merchant_name: profile.username, nbfc_id: nbfc.nbfc_id, nbfc_name: nbfc.name },
        });
      } catch (_) {}

      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Failed to create tie-up request');
    } finally {
      setRequesting(null);
    }
  };

  const openDetails = async (nbfc: NbfcProfile) => {
    setSelected(nbfc);
    setDetails(null);
    setDetailsLoading(true);
    setDetailsTab(0);
    try {
      const { data, error } = await supabase
        .from('nbfc_profiles')
        .select('*')
        .eq('nbfc_id', nbfc.nbfc_id)
        .maybeSingle();
      if (error) throw error;
      setDetails(data || {});
    } catch (e) {
      setDetails({});
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setDetails(null);
    setDetailsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading NBFCs...</p>
        </div>
      </div>
    );
  }

  if (profile && !profile.is_active) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Your merchant account is pending approval by the Super Admin. Please wait until your account is activated.</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Select an NBFC</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Choose your financing partner to continue.</p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ncfcs.map((n) => (
            <div key={n.nbfc_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{n.name}</h3>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                <p>Interest: <span className="font-medium">{n.interest_rate}% p.a</span></p>
                <p>Processing Fee: <span className="font-medium">₹{n.processing_fee}</span></p>
                <p>Approval ETA: <span className="font-medium">{n.approval_type}</span></p>
              </div>
              <div className="mt-4">
                <button onClick={() => openDetails(n)}
                  className={`px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700`}>
                  View details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    {selected && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={closeDetails}></div>
        <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selected!.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">NBFC details</p>
          </div>
          <div className="px-6 py-4">
            {detailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  {DETAIL_TABS.map((t, i) => (
                    <button key={t} type="button" onClick={()=>setDetailsTab(i)}
                      className={`px-3 py-1.5 rounded-full border text-sm ${detailsTab===i ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-800'}`}
                    >{t}</button>
                  ))}
                </div>

                {detailsTab===0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Name</div>
                      <div className="font-medium text-gray-900 dark:text-white">{selected!.name}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Notes</div>
                      <div className="font-medium text-gray-900 dark:text-white whitespace-pre-wrap">{details?.notes || '-'}</div>
                    </div>
                  </div>
                )}

                {detailsTab===1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Interest Rate</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.interest_rate ?? selected!.interest_rate}% p.a</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Processing Fee (₹)</div>
                      <div className="font-medium text-gray-900 dark:text-white">₹{details?.processing_fee ?? selected!.processing_fee}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Processing Fee (%)</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.processing_fee_percent ?? '-'}%</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Pre-closure Charge (%)</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.preclosure_charge_percent ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Late Payment Fee (%)</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.late_payment_fee_percent ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Documentation Charges (₹)</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.documentation_charges ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">GST Applicable</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.gst_applicable ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                )}

                {detailsTab===2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Approval Type</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.approval_type ?? selected!.approval_type}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Average Approval Time</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.average_approval_time || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">KYC Method</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.kyc_method || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Disbursement Modes</div>
                      <div className="font-medium text-gray-900 dark:text-white">{Array.isArray(details?.disbursement_modes) ? details.disbursement_modes.join(', ') : '-'}</div>
                    </div>
                  </div>
                )}

                {detailsTab===3 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">CIN / Registration No.</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.cin_number || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">RBI License No.</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.rbi_license_number || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">NBFC Type</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.nbfc_type || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Year of Incorporation</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.year_of_incorporation ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Head Office Address</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.head_office_address || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Contact Number</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.contact_number || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Official Email</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.official_email || '-'}</div>
                    </div>
                  </div>
                )}

                {detailsTab===4 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Min Loan Amount (₹)</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.min_loan_amount ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Max Loan Amount (₹)</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.max_loan_amount ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Tenure Options (months)</div>
                      <div className="font-medium text-gray-900 dark:text-white">{Array.isArray(details?.tenure_options) ? details.tenure_options.join(', ') : '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Repayment Frequency</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.repayment_frequency || '-'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Interest Type</div>
                      <div className="font-medium text-gray-900 dark:text-white">{details?.interest_type || '-'}</div>
                    </div>
                  </div>
                )}

                {detailsTab===5 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">RBI Certificate</div>
                      <div>{details?.rbi_certificate_url ? (<a href={details.rbi_certificate_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a>) : (<span className="text-gray-500">Not uploaded</span>)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">PAN/GST Document</div>
                      <div>{details?.pan_gst_doc_url ? (<a href={details.pan_gst_doc_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a>) : (<span className="text-gray-500">Not uploaded</span>)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">GST Certificate</div>
                      <div>{details?.gst_certificate_url ? (<a href={details.gst_certificate_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a>) : (<span className="text-gray-500">Not uploaded</span>)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Digital Signature</div>
                      <div>{details?.digital_signature_url ? (<a href={details.digital_signature_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a>) : (<span className="text-gray-500">Not uploaded</span>)}</div>
                    </div>
                  </div>
                )}

                {detailsTab===6 && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Notes</div>
                    <div className="font-medium text-gray-900 dark:text-white whitespace-pre-wrap">{details?.notes || '-'}</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
            <button onClick={closeDetails} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">Close</button>
            <button
              onClick={() => selected && requestTieUp(selected)}
              disabled={detailsLoading || requesting === selected!.nbfc_id}
              className={`px-4 py-2 rounded-lg text-white ${detailsLoading || requesting === selected!.nbfc_id ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {requesting === selected!.nbfc_id ? 'Requesting...' : 'Tie up with this NBFC'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

